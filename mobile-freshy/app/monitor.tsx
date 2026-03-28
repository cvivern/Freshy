import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE, fetchHouseholds, fetchStorageAreas, type StorageArea } from '@/services/api';

type DetectionResult = {
  accion: 'entrada' | 'salida' | 'ninguno';
  producto_nombre: string;
  producto_emoji: string;
  cantidad: number;
  confianza: number;
  descripcion: string;
  removal_id?: string;
};

type PendingRemoval = {
  id: string;
  product_name: string;
  product_emoji: string;
  cantidad: number;
  removed_at: string;
};

export default function MonitorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [analyzing, setAnalyzing] = useState(false);
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [lastResult, setLastResult] = useState<DetectionResult | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<PendingRemoval[]>([]);
  const frameBeforeRef = useRef<string | null>(null);

  // Load households then storage areas
  useEffect(() => {
    if (!user) return;
    fetchHouseholds(user.user_id, user.access_token).then(households => {
      if (households.length === 0) return;
      return fetchStorageAreas(households[0].id, user.access_token);
    }).then(areas => {
      if (!areas) return;
      setStorageAreas(areas);
      if (areas.length > 0) setSelectedArea(areas[0].id);
    }).catch(() => {});
  }, [user]);

  // Poll pending removals every 30s
  useEffect(() => {
    if (!user) return;
    const poll = () => {
      fetch(`${API_BASE}/api/v1/monitor/pending/${user.user_id}`)
        .then(r => r.json())
        .then(data => setPendingRemovals(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [user]);

  async function captureFrame(): Promise<string | null> {
    if (!cameraRef.current) return null;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        skipProcessing: true,
      });
      return photo?.base64 ?? null;
    } catch {
      return null;
    }
  }

  async function handleCaptureBefore() {
    const b64 = await captureFrame();
    if (b64) {
      frameBeforeRef.current = b64;
      Alert.alert('Frame capturado', 'Ahora realizá el movimiento y presioná "Analizar después"');
    }
  }

  async function handleCaptureAfterAndAnalyze() {
    if (!frameBeforeRef.current) {
      Alert.alert('Primero capturá el frame inicial');
      return;
    }
    if (!selectedArea) {
      Alert.alert('Seleccioná un espacio primero');
      return;
    }
    setAnalyzing(true);
    const afterB64 = await captureFrame();
    if (!afterB64) {
      setAnalyzing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/monitor/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame_before_b64: frameBeforeRef.current,
          frame_after_b64: afterB64,
          storage_area_id: selectedArea,
          user_id: user?.user_id ?? '',
          auto_register: true,
        }),
      });
      const data: DetectionResult = await res.json();
      setLastResult(data);
      frameBeforeRef.current = null;

      if (data.accion !== 'ninguno') {
        const icon = data.accion === 'salida' ? '📤' : '📥';
        const verb = data.accion === 'salida' ? 'salió' : 'entró';
        Alert.alert(
          `${icon} Detectado`,
          `${data.producto_emoji} ${data.producto_nombre} ${verb}\nConfianza: ${Math.round(data.confianza * 100)}%`,
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleMarkReturned(removal: PendingRemoval) {
    try {
      await fetch(`${API_BASE}/api/v1/monitor/returned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removal_id: removal.id }),
      });
      setPendingRemovals(prev => prev.filter(r => r.id !== removal.id));
    } catch {}
  }

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Se necesita acceso a la cámara</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitor de espacio</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Camera */}
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>Analizando con IA...</Text>
          </View>
        )}
      </CameraView>

      {/* Space selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaScroll}>
        {storageAreas.map(area => (
          <TouchableOpacity
            key={area.id}
            style={[styles.areaChip, selectedArea === area.id && styles.areaChipActive]}
            onPress={() => setSelectedArea(area.id)}
          >
            <Text style={[styles.areaChipText, selectedArea === area.id && styles.areaChipTextActive]}>
              {area.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btnBefore} onPress={handleCaptureBefore} disabled={analyzing}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Antes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnAfter, !frameBeforeRef.current && styles.btnDisabled]}
          onPress={handleCaptureAfterAndAnalyze}
          disabled={analyzing}
        >
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Analizar después</Text>
        </TouchableOpacity>
      </View>

      {/* Last result */}
      {lastResult && lastResult.accion !== 'ninguno' && (
        <View style={[styles.resultCard, lastResult.accion === 'salida' ? styles.resultOut : styles.resultIn]}>
          <Text style={styles.resultEmoji}>{lastResult.producto_emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultName}>{lastResult.producto_nombre}</Text>
            <Text style={styles.resultDesc}>{lastResult.descripcion}</Text>
          </View>
          <Text style={styles.resultAction}>{lastResult.accion === 'salida' ? '📤' : '📥'}</Text>
        </View>
      )}

      {/* Pending removals (not returned) */}
      {pendingRemovals.length > 0 && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Sin devolver</Text>
          {pendingRemovals.map(r => (
            <View key={r.id} style={styles.pendingRow}>
              <Text style={styles.pendingEmoji}>{r.product_emoji}</Text>
              <Text style={styles.pendingName}>{r.product_name}</Text>
              <TouchableOpacity style={styles.returnBtn} onPress={() => handleMarkReturned(r)}>
                <Text style={styles.returnBtnText}>Devuelto</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#1A1A2E' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  camera: { height: 280, backgroundColor: '#000' },
  analyzingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  analyzingText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  areaScroll: { maxHeight: 52, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1A1A2E' },
  areaChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#2A2A3E', marginRight: 8 },
  areaChipActive: { backgroundColor: '#A8CFEE' },
  areaChipText: { color: '#888', fontSize: 13, fontWeight: '600' },
  areaChipTextActive: { color: '#fff' },
  controls: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#1A1A2E' },
  btnBefore: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4A4A6A', borderRadius: 12, paddingVertical: 14 },
  btnAfter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#A8CFEE', borderRadius: 12, paddingVertical: 14 },
  btnDisabled: { opacity: 0.4 },
  btn: { backgroundColor: '#A8CFEE', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, alignSelf: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  permText: { color: '#fff', textAlign: 'center', marginTop: 100, fontSize: 16 },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 14, borderRadius: 12 },
  resultOut: { backgroundColor: '#3A1A1A' },
  resultIn: { backgroundColor: '#1A3A1A' },
  resultEmoji: { fontSize: 32 },
  resultName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultDesc: { color: '#AAA', fontSize: 13, marginTop: 2 },
  resultAction: { fontSize: 24 },
  pendingBox: { margin: 16, backgroundColor: '#2A1A1A', borderRadius: 12, padding: 14 },
  pendingTitle: { color: '#FFA500', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  pendingEmoji: { fontSize: 22 },
  pendingName: { flex: 1, color: '#fff', fontSize: 14 },
  returnBtn: { backgroundColor: '#2A4A2A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  returnBtnText: { color: '#7CFC00', fontSize: 13, fontWeight: '600' },
});
