/**
 * useSpaceMonitor
 * ---------------
 * Background hook that silently monitors a storage space via camera.
 * Renders a 1x1 hidden CameraView and detects product enter/exit events.
 * On detection → updates inventory + fires local notification.
 *
 * Usage:
 *   const { MonitorCamera } = useSpaceMonitor({ storageAreaId, userId, enabled })
 *   // Render <MonitorCamera /> anywhere (it's invisible, 1x1 px)
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { API_BASE } from '@/services/api';
import { useMonitor } from '@/contexts/MonitorContext';
import { supabase } from '@/services/supabase';

const CAPTURE_INTERVAL_MS = 4000;   // take photo every 4 seconds
const MOTION_THRESHOLD    = 0.05;   // 5% pixel difference = motion
const MOTION_COOLDOWN_MS  = 2500;   // 2.5s of calm before "after" frame

type MonitorEvent = {
  accion: 'entrada' | 'salida' | 'ninguno';
  producto_nombre: string;
  producto_emoji: string;
  cantidad: number;
  confianza: number;
  descripcion: string;
  removal_id?: string;
};

type UseSpaceMonitorOptions = {
  storageAreaId: string;
  userId: string;
  enabled?: boolean;
  onEvent?: (event: MonitorEvent) => void;
};

// Minimal pixel-diff motion detection between two base64 JPEGs
// Returns a number 0.0–1.0 (fraction of different pixels)
async function detectMotion(b64a: string, b64b: string): Promise<number> {
  // We compare string chunks as a cheap proxy for visual difference.
  // Not pixel-perfect but fast and works well enough for coarse motion detection.
  if (!b64a || !b64b) return 0;
  const len = Math.min(b64a.length, b64b.length);
  const sample = Math.min(len, 2000);
  let diff = 0;
  const step = Math.floor(len / sample);
  for (let i = 0; i < sample; i++) {
    if (b64a[i * step] !== b64b[i * step]) diff++;
  }
  return diff / sample;
}

async function sendNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

export function useSpaceMonitor({
  storageAreaId,
  userId,
  enabled = true,
  onEvent,
}: UseSpaceMonitorOptions) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { showMonitorToast } = useMonitor();

  const lastB64Ref      = useRef<string | null>(null);
  const beforeB64Ref    = useRef<string | null>(null);
  const inMotionRef     = useRef(false);
  const lastMotionTRef  = useRef(0);
  const analyzingRef    = useRef(false);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<'idle' | 'watching' | 'motion' | 'analyzing'>('idle');

  const captureAndProcess = useCallback(async () => {
    if (!cameraRef.current || analyzingRef.current || !enabled) return;

    let b64: string | null = null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.25,
      });
      b64 = photo?.base64 ?? null;
    } catch (e) {
      console.warn('[SpaceMonitor] takePictureAsync failed:', e);
      return;
    }
    if (!b64) return;

    const prev = lastB64Ref.current;
    lastB64Ref.current = b64;
    if (!prev) return;

    const motionScore = await detectMotion(prev, b64);
    const hasMotion = motionScore > MOTION_THRESHOLD;

    if (hasMotion) {
      lastMotionTRef.current = Date.now();
      if (!inMotionRef.current) {
        beforeB64Ref.current = prev;
        inMotionRef.current = true;
        setMonitorStatus('motion');
      }
    } else {
      if (inMotionRef.current) {
        const elapsed = Date.now() - lastMotionTRef.current;
        if (elapsed >= MOTION_COOLDOWN_MS && beforeB64Ref.current) {
          inMotionRef.current = false;
          analyzingRef.current = true;
          setMonitorStatus('analyzing');

          const beforeB64 = beforeB64Ref.current;
          const afterB64  = b64;
          beforeB64Ref.current = null;

          try {
            const res = await fetch(`${API_BASE}/api/v1/monitor/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                frame_before_b64: beforeB64,
                frame_after_b64:  afterB64,
                storage_area_id:  storageAreaId,
                user_id:          userId,
                auto_register:    true,
              }),
            });
            const event: MonitorEvent = await res.json();

            if ((event.accion === 'salida' || event.accion === 'entrada') && event.confianza > 0.55) {
              onEvent?.(event);

              const emoji     = event.producto_emoji ?? '📦';
              const nombre    = event.producto_nombre ?? 'producto';
              const remaining = (event as any).cantidad_restante ?? null;

              // ── Popup en pantalla (inmediato) ──
              showMonitorToast({
                accion:             event.accion,
                producto_nombre:    nombre,
                producto_emoji:     emoji,
                cantidad_restante:  remaining,
              });

              // ── Notificación push (también, para cuando la app está en background) ──
              if (event.accion === 'salida') {
                if (remaining !== null && remaining <= 0) {
                  await sendNotification(`${emoji} Ya no tenés ${nombre}`, '¿Lo agregamos a la lista de compras?');
                } else if (remaining !== null) {
                  const unit = remaining === 1 ? 'unidad' : 'unidades';
                  const verb = remaining === 1 ? 'queda' : 'quedan';
                  await sendNotification(`${emoji} Retiraste ${nombre}`, `Te ${verb} ${remaining} ${unit}`);
                } else {
                  await sendNotification(`${emoji} Retiraste ${nombre}`, event.descripcion ?? '');
                }
              } else {
                if (remaining !== null) {
                  await sendNotification(`${emoji} Agregaste ${nombre}`, `Ahora tenés ${remaining} ${remaining === 1 ? 'unidad' : 'unidades'}`);
                }
              }
            }
          } catch (e) {
            console.warn('[SpaceMonitor] analyze error:', e);
          } finally {
            analyzingRef.current = false;
            setMonitorStatus('watching');
          }
        }
      }
    }
  }, [storageAreaId, userId, enabled, onEvent]);

  useEffect(() => {
    if (!enabled || !permission?.granted) return;
    setMonitorStatus('watching');
    intervalRef.current = setInterval(captureAndProcess, CAPTURE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setMonitorStatus('idle');
    };
  }, [enabled, permission?.granted, captureAndProcess]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // ── Supabase Realtime: escucha eventos del PC u otros dispositivos ──
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`monitor_events:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'monitor_events',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row || !row.accion) return;

          const emoji     = row.producto_emoji ?? '📦';
          const nombre    = row.producto_nombre ?? 'producto';
          const remaining = row.cantidad_restante ?? null;

          // Mostrar toast en pantalla
          showMonitorToast({
            accion:            row.accion,
            producto_nombre:   nombre,
            producto_emoji:    emoji,
            cantidad_restante: remaining,
          });

          // Notificación push
          if (row.accion === 'salida') {
            if (remaining !== null && remaining <= 0) {
              await sendNotification(`${emoji} Ya no tenés ${nombre}`, '¿Lo agregamos a la lista de compras?');
            } else if (remaining !== null) {
              const unit = remaining === 1 ? 'unidad' : 'unidades';
              const verb = remaining === 1 ? 'queda' : 'quedan';
              await sendNotification(`${emoji} Retiraste ${nombre}`, `Te ${verb} ${remaining} ${unit}`);
            }
          } else if (row.accion === 'entrada' && remaining !== null) {
            await sendNotification(`${emoji} Agregaste ${nombre}`, `Ahora tenés ${remaining} ${remaining === 1 ? 'unidad' : 'unidades'}`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, showMonitorToast]);

  // Cámara oculta + indicador de estado
  const MonitorCamera = useCallback(() => {
    if (!enabled) return null;

    const dotColor =
      monitorStatus === 'analyzing' ? '#FFA500' :
      monitorStatus === 'motion'    ? '#FF4444' :
      monitorStatus === 'watching'  ? '#44CC44' : '#888';

    const dotLabel =
      monitorStatus === 'analyzing' ? 'IA analizando...' :
      monitorStatus === 'motion'    ? 'Movimiento detectado' :
      monitorStatus === 'watching'  ? 'Monitor activo' : '';

    return React.createElement(
      View,
      { style: monStyles.wrapper },
      // Cámara oculta — dentro de bounds, opacity 0
      permission?.granted
        ? React.createElement(
            View,
            { style: monStyles.cameraWrap },
            React.createElement(CameraView, {
              ref: cameraRef,
              style: monStyles.camera,
              facing: 'back',
            })
          )
        : null,
      // Indicador visible
      monitorStatus !== 'idle'
        ? React.createElement(
            View,
            { style: monStyles.indicator },
            React.createElement(View, { style: [monStyles.dot, { backgroundColor: dotColor }] }),
            React.createElement(Text, { style: monStyles.label }, dotLabel)
          )
        : null
    );
  }, [permission?.granted, enabled, monitorStatus]);

  return { MonitorCamera, monitorStatus };
}

const monStyles = StyleSheet.create({
  wrapper:    { position: 'absolute', bottom: 80, right: 12, alignItems: 'flex-end', zIndex: 100 },
  cameraWrap: { width: 1, height: 1, overflow: 'hidden' },
  camera:     { width: 1, height: 1 },
  indicator:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  label:      { color: '#fff', fontSize: 11, fontWeight: '600' },
});
