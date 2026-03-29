import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMonitor } from '@/contexts/MonitorContext';
import {
  fetchHouseholds,
  fetchStorageAreas,
  quickScanUpdate,
} from '@/services/api';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';
import type { HogarOption } from '@/components/AppHeaderConEleccionHogar';

type ScanState = 'idle' | 'scanning' | 'done' | 'no_match' | 'error';

export default function ScanScreen() {
  const { user } = useAuth();
  const { showMonitorToast } = useMonitor();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [storageAreaId, setStorageAreaId] = useState('');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lastResult, setLastResult] = useState<{ name: string; emoji: string; action: 'in' | 'out'; qty: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Load households on mount
  React.useEffect(() => {
    if (!user?.user_id) return;
    fetchHouseholds(user.user_id, user.access_token).then((hs) => {
      setHogares(hs.map((h) => ({ id: h.id, name: h.name })));
      if (hs.length > 0) setSelectedHouseholdId(hs[0].id);
    });
  }, [user?.user_id]);

  // Load storage area when household changes
  React.useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchStorageAreas(selectedHouseholdId, user?.access_token).then((areas) => {
      setStorageAreaId(areas.length > 0 ? areas[0].id : '');
    });
  }, [selectedHouseholdId]);

  const handleScan = async (action: 'in' | 'out') => {
    if (!cameraRef.current || !storageAreaId || scanState === 'scanning') return;
    setScanState('scanning');
    setLastResult(null);
    setErrorMsg('');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (!photo?.uri) throw new Error('No se pudo tomar la foto');

      const result = await quickScanUpdate(photo.uri, storageAreaId, action, user?.access_token);

      if (result.matched) {
        setLastResult({
          name: result.name,
          emoji: result.emoji,
          action,
          qty: result.quantity_after,
        });
        setScanState('done');
        showMonitorToast({
          accion: action === 'in' ? 'entrada' : 'salida',
          producto_nombre: result.name,
          producto_emoji: result.emoji,
          cantidad_restante: result.quantity_after,
        });
      } else {
        setScanState('no_match');
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error al escanear');
      setScanState('error');
    }
  };

  const reset = () => {
    setScanState('idle');
    setLastResult(null);
    setErrorMsg('');
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Ionicons name="camera-outline" size={48} color="#A8CFEE" />
        <Text style={styles.permText}>Se necesita acceso a la cámara</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={setSelectedHouseholdId}
      />

      {/* Camera */}
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />

        {/* Scanning overlay */}
        {scanState === 'scanning' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>Detectando producto...</Text>
          </View>
        )}

        {/* Result overlay */}
        {(scanState === 'done' || scanState === 'no_match' || scanState === 'error') && (
          <View style={styles.overlay}>
            {scanState === 'done' && lastResult && (
              <>
                <Text style={styles.resultEmoji}>{lastResult.emoji}</Text>
                <Text style={styles.resultName}>{lastResult.name}</Text>
                <Text style={styles.resultQty}>
                  {lastResult.action === 'in' ? '📥 Entró' : '📤 Salió'} · quedan {lastResult.qty}
                </Text>
              </>
            )}
            {scanState === 'no_match' && (
              <>
                <Text style={styles.resultEmoji}>🔍</Text>
                <Text style={styles.resultName}>No encontrado</Text>
                <Text style={styles.resultSub}>Este producto no está en tu inventario</Text>
              </>
            )}
            {scanState === 'error' && (
              <>
                <Text style={styles.resultEmoji}>⚠️</Text>
                <Text style={styles.resultName}>Error</Text>
                <Text style={styles.resultSub}>{errorMsg}</Text>
              </>
            )}
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Escanear otro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Corner frame */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      {/* Action buttons */}
      {scanState === 'idle' && (
        <View style={styles.actions}>
          {!storageAreaId ? (
            <Text style={styles.noAreaText}>Seleccioná un hogar con espacio configurado</Text>
          ) : (
            <>
              <Text style={styles.hint}>Apuntá la cámara al producto y elegí la acción</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.btnIn]} onPress={() => handleScan('in')}>
                  <Ionicons name="arrow-down-circle-outline" size={28} color="#fff" />
                  <Text style={styles.actionBtnText}>Entró</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.btnOut]} onPress={() => handleScan('out')}>
                  <Ionicons name="arrow-up-circle-outline" size={28} color="#fff" />
                  <Text style={styles.actionBtnText}>Salió</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  cameraWrap: { flex: 1, position: 'relative', backgroundColor: '#000' },
  camera: { flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  overlayText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
  resultEmoji: { fontSize: 56 },
  resultName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  resultQty: { color: '#A8CFEE', fontSize: 15, fontWeight: '600' },
  resultSub: { color: '#AAA', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  resetBtn: { marginTop: 8, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 10 },
  resetBtnText: { color: '#222', fontWeight: '700', fontSize: 15 },

  // Frame corners
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#A8CFEE', borderWidth: 3 },
  cornerTL: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0 },

  actions: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  hint: { textAlign: 'center', color: '#666', fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
  },
  btnIn: { backgroundColor: '#27AE60' },
  btnOut: { backgroundColor: '#2980B9' },
  actionBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  permContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  permText: { fontSize: 16, color: '#444', textAlign: 'center' },
  permBtn: { backgroundColor: '#A8CFEE', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  noAreaText: { textAlign: 'center', color: '#999', fontSize: 14 },
});
