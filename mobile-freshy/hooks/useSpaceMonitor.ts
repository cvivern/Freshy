/**
 * useSpaceMonitor
 * ---------------
 * Escucha eventos de detección de productos via Supabase Realtime.
 * La cámara real corre en la PC (tools/space_monitor_test.py).
 * El teléfono solo recibe los eventos y muestra el toast + notificación.
 *
 * Uso:
 *   const { MonitorIndicator } = useSpaceMonitor({ userId, enabled })
 *   // Render <MonitorIndicator /> donde quieras mostrar el estado de conexión
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMonitor } from '@/contexts/MonitorContext';
import { supabase } from '@/services/supabase';

type UseSpaceMonitorOptions = {
  userId: string;
  enabled?: boolean;
};

async function sendNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {}
}

export function useSpaceMonitor({ userId, enabled = true }: UseSpaceMonitorOptions) {
  const { showMonitorToast } = useMonitor();
  const [connected, setConnected] = useState(false);
  const lastEventRef = useRef<number>(0);

  useEffect(() => {
    if (!userId || !enabled) return;

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
          if (!row?.accion) return;

          lastEventRef.current = Date.now();

          const emoji     = row.producto_emoji ?? '📦';
          const nombre    = row.producto_nombre ?? 'producto';
          const remaining = row.cantidad_restante ?? null;

          // Toast en pantalla
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
            } else {
              await sendNotification(`${emoji} Retiraste ${nombre}`, row.descripcion ?? '');
            }
          } else if (row.accion === 'entrada') {
            if (remaining !== null) {
              await sendNotification(`${emoji} Agregaste ${nombre}`, `Ahora tenés ${remaining} ${remaining === 1 ? 'unidad' : 'unidades'}`);
            }
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [userId, enabled, showMonitorToast]);

  // Indicador de conexión — solo muestra algo cuando está conectado
  const MonitorIndicator = useCallback(() => {
    if (!enabled || !connected) return null;
    return React.createElement(
      View,
      { style: monStyles.indicator },
      React.createElement(View, { style: monStyles.dot }),
      React.createElement(Text, { style: monStyles.label }, 'Escuchando cámara')
    );
  }, [enabled, connected]);

  return { MonitorIndicator, connected };
}

const monStyles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    bottom: 80,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 100,
  },
  dot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#44CC44' },
  label: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
