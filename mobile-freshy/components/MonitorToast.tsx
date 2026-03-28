import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMonitor } from '@/contexts/MonitorContext';

export default function MonitorToast() {
  const { toast, visible, hide } = useMonitor();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!toast) return null;

  const isSalida = toast.accion === 'salida';
  const bgColor  = isSalida ? '#1C3A5E' : '#1A3A2A';
  const accent   = isSalida ? '#A8CFEE' : '#5EBF7A';
  const icon     = isSalida ? '📤' : '📥';
  const verb     = isSalida ? 'Retiraste' : 'Agregaste';

  let subtitle = '';
  if (toast.cantidad_restante !== null) {
    if (isSalida && toast.cantidad_restante <= 0) {
      subtitle = '⚠️ Ya no te queda ninguno';
    } else {
      const unit = toast.cantidad_restante === 1 ? 'unidad' : 'unidades';
      const verb2 = isSalida
        ? (toast.cantidad_restante === 1 ? 'Te queda' : 'Te quedan')
        : 'Ahora tenés';
      subtitle = `${verb2} ${toast.cantidad_restante} ${unit}`;
    }
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, backgroundColor: bgColor, transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity style={styles.inner} onPress={hide} activeOpacity={0.85}>
        {/* Barra de color lateral */}
        <View style={[styles.strip, { backgroundColor: accent }]} />

        {/* Emoji del producto */}
        <Text style={styles.emoji}>{toast.producto_emoji}</Text>

        {/* Texto */}
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.icon}>{icon}</Text>
            <Text style={styles.verb}>{verb}</Text>
          </View>
          <Text style={styles.nombre} numberOfLines={1}>{toast.producto_nombre}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, toast.cantidad_restante === 0 && styles.subtitleWarn]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Dismiss */}
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 9999,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  strip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  emoji: {
    fontSize: 36,
    marginLeft: 6,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 13,
  },
  verb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#AAA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nombre: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#AAA',
    marginTop: 1,
  },
  subtitleWarn: {
    color: '#FFB347',
    fontWeight: '600',
  },
  close: {
    color: '#666',
    fontSize: 14,
    paddingLeft: 4,
  },
});
