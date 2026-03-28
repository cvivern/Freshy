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
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React from 'react';
import { View } from 'react-native';
import { API_BASE } from '@/services/api';

const CAPTURE_INTERVAL_MS = 3000;   // take photo every 3 seconds
const MOTION_THRESHOLD    = 0.04;   // 4% pixel difference = motion
const MOTION_COOLDOWN_MS  = 2000;   // 2s of calm before "after" frame

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

  const lastB64Ref      = useRef<string | null>(null);
  const beforeB64Ref    = useRef<string | null>(null);
  const inMotionRef     = useRef(false);
  const lastMotionTRef  = useRef(0);
  const analyzingRef    = useRef(false);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureAndProcess = useCallback(async () => {
    if (!cameraRef.current || analyzingRef.current || !enabled) return;

    let b64: string | null = null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
        shutterSound: false,
      });
      b64 = photo?.base64 ?? null;
    } catch {
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
        // Save "before" frame (the previous stable frame)
        beforeB64Ref.current = prev;
        inMotionRef.current = true;
      }
    } else {
      if (inMotionRef.current) {
        const elapsed = Date.now() - lastMotionTRef.current;
        if (elapsed >= MOTION_COOLDOWN_MS && beforeB64Ref.current) {
          // Motion ended → analyze
          inMotionRef.current = false;
          analyzingRef.current = true;

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

            if (event.accion === 'salida' && event.confianza > 0.55) {
              onEvent?.(event);

              const emoji  = event.producto_emoji ?? '📦';
              const nombre = event.producto_nombre ?? 'producto';
              // Backend already decremented inventory and returns cantidad_restante
              const remaining = (event as any).cantidad_restante ?? null;

              if (remaining !== null && remaining <= 0) {
                await sendNotification(
                  `${emoji} Ya no tenés ${nombre}`,
                  '¿Lo agregamos a la lista de compras?'
                );
              } else if (remaining !== null) {
                const unit = remaining === 1 ? 'unidad' : 'unidades';
                const verb = remaining === 1 ? 'queda' : 'quedan';
                await sendNotification(
                  `${emoji} Retiraste ${nombre}`,
                  `Te ${verb} ${remaining} ${unit}`
                );
              } else {
                await sendNotification(
                  `${emoji} Retiraste ${nombre}`,
                  event.descripcion ?? ''
                );
              }
            } else if (event.accion === 'entrada' && event.confianza > 0.55) {
              onEvent?.(event);
              const emoji  = event.producto_emoji ?? '📦';
              const nombre = event.producto_nombre ?? 'producto';
              const remaining = (event as any).cantidad_restante ?? null;
              if (remaining !== null) {
                await sendNotification(
                  `${emoji} Agregaste ${nombre}`,
                  `Ahora tenés ${remaining} ${remaining === 1 ? 'unidad' : 'unidades'}`
                );
              }
            }
          } catch {
            // Silently ignore network errors
          } finally {
            analyzingRef.current = false;
          }
        }
      }
    }
  }, [storageAreaId, userId, enabled, onEvent]);

  useEffect(() => {
    if (!enabled || !permission?.granted) return;
    intervalRef.current = setInterval(captureAndProcess, CAPTURE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, permission?.granted, captureAndProcess]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // The invisible camera component — caller renders this hidden
  const MonitorCamera = useCallback(() => {
    if (!permission?.granted || !enabled) return null;
    return React.createElement(
      View,
      { style: { width: 1, height: 1, opacity: 0, position: 'absolute', top: -10, left: -10 } },
      React.createElement(CameraView, {
        ref: cameraRef,
        style: { width: 1, height: 1 },
        facing: 'back',
      })
    );
  }, [permission?.granted, enabled]);

  return { MonitorCamera };
}
