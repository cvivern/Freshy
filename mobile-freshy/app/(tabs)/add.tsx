import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';

// ------- Config -------
// Android emulator → 10.0.2.2 | iOS simulator → localhost | dispositivo físico → IP de tu PC
const API_BASE = 'http://10.0.2.2:8000';

// ------- Types -------
type ProductCategory = 'fruta_verdura' | 'otro';

type Phase =
  | 'select_type'
  | 'camera_product'     // cámara in-app para foto de marca
  | 'detecting_product'  // procesando primera foto
  | 'product_popup'      // popup sobre la foto: categoría + marca + nombre
  | 'camera_barcode'     // cámara in-app para código/fecha
  | 'detecting_barcode'  // procesando segunda foto (vision AI lee barcode+fecha)
  | 'barcode_popup';     // popup con datos leídos (editables) → guardar

type Detection = { label: string; confidence: number };
type ProductInfo = { category: string; brand: string; name: string };
type BarcodeInfo = { barcode: string; expiryDate: string };
type FavoriteProduct = { id: number; emoji: string; name: string };
type RestockState = {
  product: FavoriteProduct;
  step: 'qty' | 'dates';
  qty: string;
  dates: string[];       // fechas ya ingresadas
  currentDate: string;   // input del turno actual
  currentIndex: number;  // índice actual (0-based)
};

// ------- Label mapping (Roboflow fruit-b2sy0) -------
const LABEL_MAP: Record<string, string> = {
  apple_fresh:       'Manzana',
  apple_rotten:      'Manzana (en mal estado)',
  banana_fresh:      'Banana',
  banana_rotten:     'Banana (en mal estado)',
  orange_fresh:      'Naranja',
  orange_rotten:     'Naranja (en mal estado)',
  mango_fresh:       'Mango',
  mango_rotten:      'Mango (en mal estado)',
  strawberry_fresh:  'Frutilla',
  strawberry_rotten: 'Frutilla (en mal estado)',
  grapes_fresh:      'Uvas',
  grapes_rotten:     'Uvas (en mal estado)',
  watermelon_fresh:  'Sandía',
  pineapple_fresh:   'Ananá',
  lemon_fresh:       'Limón',
};

function parseFruitDetections(detections: Detection[]): ProductInfo {
  if (!detections.length) return { category: 'Frutas y verduras', brand: '—', name: 'No reconocido' };
  const best = detections.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  const name = LABEL_MAP[best.label] ?? best.label.replace(/_/g, ' ');
  return { category: 'Frutas y verduras', brand: '—', name };
}

// ------- API calls -------
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Verificá que el backend esté corriendo.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function detectFrutaVerdura(uri: string): Promise<ProductInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/detection/fruits`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return parseFruitDetections((data.detections ?? []) as Detection[]);
}

async function detectOtroProducto(uri: string): Promise<ProductInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/detection/scan/product`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return {
    category: 'Producto envasado',
    brand: data.brand ?? '—',
    name: data.name ?? '—',
  };
}

async function scanBarcodeImage(uri: string): Promise<BarcodeInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/detection/scan/barcode`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return {
    barcode: data.barcode ?? '',
    expiryDate: data.expiry_date ?? '',
  };
}

// ------- Mock Data -------
const FAVORITE_PRODUCTS: FavoriteProduct[] = [
  { id: 1, emoji: '🍞', name: 'Pan' },
  { id: 2, emoji: '🧈', name: 'Manteca' },
  { id: 3, emoji: '🍌', name: 'Banana' },
];

// ------- Main Screen -------
export default function AddScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('select_type');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo>({ category: '', brand: '', name: '' });
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo>({ barcode: '', expiryDate: '' });
  const [restock, setRestock] = useState<RestockState | null>(null);

  function selectCategory(cat: ProductCategory) {
    setCategory(cat);
    openProductCamera();
  }

  async function openProductCamera() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
        return;
      }
    }
    setPhase('camera_product');
  }

  async function openBarcodeCamera() {
    setPhase('camera_barcode');
  }

  async function captureProductPhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (!photo) return;
    setPhotoUri(photo.uri);
    setPhase('detecting_product');
    try {
      const info = category === 'fruta_verdura'
        ? await detectFrutaVerdura(photo.uri)
        : await detectOtroProducto(photo.uri);
      setProductInfo(info);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert(
        'No se pudo conectar',
        `${msg}\n\nVerificá que el backend esté corriendo en ${API_BASE}.`,
        [{ text: 'OK', onPress: () => setPhase('camera_product') }]
      );
      return;
    }
    setPhase('product_popup');
  }

  async function captureBarcodePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    if (!photo) return;
    setPhotoUri(photo.uri);
    setPhase('detecting_barcode');
    try {
      const info = await scanBarcodeImage(photo.uri);
      setBarcodeInfo(info);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert(
        'No se pudo leer la imagen',
        `${msg}\n\nPodés ingresar los datos manualmente.`,
        [{ text: 'OK' }]
      );
    }
    setPhase('barcode_popup');
  }

  function handleSave() {
    if (!barcodeInfo.expiryDate.trim()) {
      Alert.alert('Fecha requerida', 'Ingresá la fecha de vencimiento.');
      return;
    }
    // TODO: insertar en Supabase tabla inventory
    Alert.alert('¡Producto guardado!', `${productInfo.name} fue agregado a tu inventario.`);
    reset();
  }

  function openRestock(product: FavoriteProduct) {
    setRestock({ product, step: 'qty', qty: '', dates: [], currentDate: '', currentIndex: 0 });
  }

  function handleRestockQtyNext() {
    if (!restock) return;
    const n = parseInt(restock.qty, 10);
    if (!restock.qty.trim() || isNaN(n) || n < 1) {
      Alert.alert('Cantidad inválida', 'Ingresá un número mayor a 0.');
      return;
    }
    setRestock((p) => p ? { ...p, step: 'dates', currentIndex: 0, currentDate: '' } : p);
  }

  function handleRestockDateNext() {
    if (!restock) return;
    if (!restock.currentDate.trim()) {
      Alert.alert('Fecha requerida', 'Ingresá la fecha de vencimiento.');
      return;
    }
    const total = parseInt(restock.qty, 10);
    const newDates = [...restock.dates, restock.currentDate];
    if (newDates.length >= total) {
      // TODO: insertar en Supabase tabla inventory (newDates.length entradas)
      Alert.alert('¡Restock guardado!', `${total} ${restock.product.name} agregados al inventario.`);
      setRestock(null);
    } else {
      setRestock((p) => p ? { ...p, dates: newDates, currentDate: '', currentIndex: p.currentIndex + 1 } : p);
    }
  }

  function reset() {
    setPhase('select_type');
    setCategory(null);
    setPhotoUri(null);
    setProductInfo({ category: '', brand: '', name: '' });
    setBarcodeInfo({ barcode: '', expiryDate: '' });
  }

  // ================================================================
  // CAMERA VIEW (product + barcode)
  // ================================================================
  if (phase === 'camera_product' || phase === 'camera_barcode') {
    const isBarcode = phase === 'camera_barcode';
    return (
      <View style={styles.fullscreen}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* Top bar */}
        <View style={styles.camTopBar}>
          <TouchableOpacity style={styles.camBackBtn} onPress={isBarcode ? () => setPhase('product_popup') : reset}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.camChip, isBarcode ? styles.camChipTeal : styles.camChipCoral]}>
            <Text style={styles.camChipText}>
              {isBarcode ? '🔍 Código y fecha' : (category === 'fruta_verdura' ? '🥦 Fruta / verdura' : '🥫 Producto')}
            </Text>
          </View>
        </View>

        {/* Center frame guide */}
        <View style={styles.camFrameWrap}>
          <View style={[styles.camFrame, isBarcode ? styles.camFrameWide : styles.camFrameSquare]}>
            <View style={[styles.camCorner, styles.camCornerTL, isBarcode && styles.camCornerTeal]} />
            <View style={[styles.camCorner, styles.camCornerTR, isBarcode && styles.camCornerTeal]} />
            <View style={[styles.camCorner, styles.camCornerBL, isBarcode && styles.camCornerTeal]} />
            <View style={[styles.camCorner, styles.camCornerBR, isBarcode && styles.camCornerTeal]} />
          </View>
          <Text style={styles.camGuideText}>
            {isBarcode
              ? 'Enfocá el código de barras y la fecha de vencimiento'
              : category === 'fruta_verdura'
                ? 'Enfocá la fruta o verdura'
                : 'Enfocá la marca del producto'}
          </Text>
        </View>

        {/* Shutter */}
        <View style={styles.camBottomBar}>
          <TouchableOpacity
            style={[styles.shutterBtn, isBarcode && styles.shutterBtnTeal]}
            onPress={isBarcode ? captureBarcodePhoto : captureProductPhoto}
            activeOpacity={0.8}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ================================================================
  // PHOTO + OVERLAY (detecting / popup)
  // ================================================================
  if (
    phase === 'detecting_product' ||
    phase === 'product_popup' ||
    phase === 'detecting_barcode' ||
    phase === 'barcode_popup'
  ) {
    const isDetecting = phase === 'detecting_product' || phase === 'detecting_barcode';

    return (
      <View style={styles.fullscreen}>
        {/* Frozen photo as background */}
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photoBackground} resizeMode="cover" />}
        <View style={styles.photoDim} />

        {/* Detecting spinner */}
        {isDetecting && (
          <View style={styles.detectingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.detectingText}>
              {phase === 'detecting_product' ? 'Reconociendo producto…' : 'Procesando imagen…'}
            </Text>
          </View>
        )}

        {/* Popup: producto reconocido */}
        <Modal visible={phase === 'product_popup'} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.card}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
                <Text style={styles.cardTitle}>¡Producto reconocido!</Text>
              </View>
              <View style={styles.detectedBox}>
                <View style={styles.detectedRow}>
                  <Text style={styles.detectedLabel}>Categoría</Text>
                  <Text style={styles.detectedValue}>{productInfo.category || '—'}</Text>
                </View>
                <View style={styles.detectedDivider} />
                <View style={styles.detectedRow}>
                  <Text style={styles.detectedLabel}>Marca</Text>
                  <Text style={styles.detectedValue}>{productInfo.brand || '—'}</Text>
                </View>
                <View style={styles.detectedDivider} />
                <View style={styles.detectedRow}>
                  <Text style={styles.detectedLabel}>Producto</Text>
                  <Text style={styles.detectedValue}>{productInfo.name || '—'}</Text>
                </View>
              </View>
              <Text style={styles.nextHint}>
                Ahora fotografiá el <Text style={styles.bold}>código de barras</Text> y la{' '}
                <Text style={styles.bold}>fecha de vencimiento</Text> — la IA los leerá automáticamente.
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('camera_product')}>
                  <Ionicons name="camera-outline" size={16} color="#888" />
                  <Text style={styles.secondaryBtnText}>Retomar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={openBarcodeCamera}>
                  <Text style={styles.primaryBtnText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Popup: código + fecha (leídos por IA, editables) */}
        <Modal visible={phase === 'barcode_popup'} transparent animationType="slide">
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.card}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
                <Text style={styles.cardTitle}>Datos detectados</Text>
              </View>
              <Text style={styles.aiHint}>
                La IA leyó estos datos de la foto. Podés corregirlos antes de guardar.
              </Text>
              <View>
                <Text style={styles.fieldLabel}>Código de barras</Text>
                <TextInput
                  style={styles.input}
                  value={barcodeInfo.barcode}
                  onChangeText={(v) => setBarcodeInfo((p) => ({ ...p, barcode: v }))}
                  placeholder="No detectado"
                  placeholderTextColor="#BBB"
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>
                  Fecha de vencimiento <Text style={styles.optional}>(requerida)</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={barcodeInfo.expiryDate}
                  onChangeText={(v) => setBarcodeInfo((p) => ({ ...p, expiryDate: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#BBB"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={openBarcodeCamera}>
                  <Ionicons name="camera-outline" size={16} color="#888" />
                  <Text style={styles.secondaryBtnText}>Retomar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleSave}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  // ================================================================
  // SELECT TYPE (pantalla principal)
  // ================================================================
  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.sectionTitle}>¿Qué vas a agregar?</Text>
        <Text style={styles.sectionSubtitle}>Elegí el tipo de producto para que la IA use el análisis correcto.</Text>

        <TouchableOpacity style={styles.categoryCard} onPress={() => selectCategory('fruta_verdura')} activeOpacity={0.8}>
          <View style={[styles.categoryIconWrap, { backgroundColor: '#DFF5E3' }]}>
            <Text style={styles.categoryEmoji}>🥦</Text>
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>Fruta o verdura</Text>
            <Text style={styles.categorySubtitle}>La IA detecta el tipo y su estado de frescura</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.categoryCard} onPress={() => selectCategory('otro')} activeOpacity={0.8}>
          <View style={[styles.categoryIconWrap, { backgroundColor: '#E8F4FF' }]}>
            <Text style={styles.categoryEmoji}>🥫</Text>
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>Producto envasado</Text>
            <Text style={styles.categorySubtitle}>Lácteos, enlatados, bebidas, snacks, etc.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o hace un restock de productos que ya tenias</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.description}>Tus productos favoritos — agregálos rápido sin escanear.</Text>
        {FAVORITE_PRODUCTS.map((product) => (
          <View key={product.id} style={styles.productRow}>
            <Text style={styles.productEmoji}>{product.emoji}</Text>
            <Text style={styles.productName}>{product.name}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => openRestock(product)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

      {/* Modal restock */}
      <Modal visible={!!restock} transparent animationType="slide" onRequestClose={() => setRestock(null)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.successRow}>
              <Text style={styles.productEmoji}>{restock?.product.emoji}</Text>
              <View>
                <Text style={styles.cardTitle}>{restock?.product.name}</Text>
                {restock?.step === 'dates' && (
                  <Text style={styles.aiHint}>
                    Unidad {(restock.currentIndex ?? 0) + 1} de {restock.qty}
                  </Text>
                )}
              </View>
            </View>

            {/* Paso 1: cantidad */}
            {restock?.step === 'qty' && (
              <View>
                <Text style={styles.fieldLabel}>¿Cuántas unidades vas a agregar?</Text>
                <TextInput
                  style={styles.input}
                  value={restock.qty}
                  onChangeText={(v) => setRestock((p) => p ? { ...p, qty: v } : p)}
                  placeholder="Ej: 3"
                  placeholderTextColor="#BBB"
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
            )}

            {/* Paso 2: fecha por unidad */}
            {restock?.step === 'dates' && (
              <View>
                <Text style={styles.fieldLabel}>
                  Fecha de vencimiento <Text style={styles.optional}>(requerida)</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={restock.currentDate}
                  onChangeText={(v) => setRestock((p) => p ? { ...p, currentDate: v } : p)}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#BBB"
                  keyboardType="numeric"
                  autoFocus
                />
                {/* Fechas ya ingresadas */}
                {restock.dates.length > 0 && (
                  <View style={styles.datesIngresadas}>
                    {restock.dates.map((d, i) => (
                      <Text key={i} style={styles.dateIngresadaText}>✓ Unidad {i + 1}: {d}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRestock(null)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              {restock?.step === 'qty' ? (
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleRestockQtyNext}>
                  <Text style={styles.primaryBtnText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleRestockDateNext}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {restock && restock.dates.length + 1 >= parseInt(restock.qty, 10) ? 'Guardar' : 'Siguiente'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  fullscreen: { flex: 1, backgroundColor: '#000' },

  // Camera UI
  camTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  camBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  camChipCoral: { backgroundColor: 'rgba(212,130,122,0.85)' },
  camChipTeal: { backgroundColor: 'rgba(74,188,176,0.85)' },
  camChipText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  camFrameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  camFrame: { position: 'relative' },
  camFrameSquare: { width: 260, height: 260 },
  camFrameWide: { width: 300, height: 160 },
  camCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#D4827A',
    borderWidth: 3,
  },
  camCornerTeal: { borderColor: '#4ABCB0' },
  camCornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  camCornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  camCornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  camCornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  camGuideText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  camBottomBar: {
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 20,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#D4827A',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnTeal: { borderColor: '#4ABCB0' },
  shutterInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },

  // Photo background
  photoBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  photoDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  detectingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  detectingText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    gap: 16,
  },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  detectedBox: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, overflow: 'hidden' },
  detectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detectedDivider: { height: 1, backgroundColor: '#F0F0F0' },
  detectedLabel: { fontSize: 13, color: '#999', fontWeight: '500' },
  detectedValue: { fontSize: 15, fontWeight: '700', color: '#222' },
  nextHint: { fontSize: 13, color: '#777', lineHeight: 20 },
  bold: { fontWeight: '700', color: '#555' },
  aiHint: { fontSize: 12, color: '#999', lineHeight: 18 },
  datesIngresadas: { marginTop: 10, gap: 4 },
  dateIngresadaText: { fontSize: 13, color: '#27AE60', fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8 },
  optional: { fontWeight: '400', color: '#AAA' },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D4827A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  btnFlex: { flex: 1 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: 14, color: '#888', fontWeight: '600' },

  // Select type screen
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  sectionSubtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 24 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  categoryIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryEmoji: { fontSize: 28 },
  categoryInfo: { flex: 1 },
  categoryTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  categorySubtitle: { fontSize: 12, color: '#999', lineHeight: 17 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { fontSize: 13, color: '#AAA', fontWeight: '500' },
  description: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 16 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productEmoji: { fontSize: 32, marginRight: 16 },
  productName: { flex: 1, fontSize: 18, fontWeight: '500', color: '#222' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4827A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
