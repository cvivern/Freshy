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
import {
  API_BASE,
  CLIMATE_EMOJI,
  addToInventory,
  createHousehold,
  createStorageArea,
  deleteHousehold,
  deleteStorageArea,
  fetchHouseholds,
  fetchInventoryItems,
  fetchStorageAreas,
  getFruitName,
  identifyFruits,
  scanBarcodeImage,
  scanPackagedProduct,
  toISODate,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { BarcodeInfo, Detection, Household, InventoryItem, PackagedScanResult, ProductInfo, StorageArea } from '@/services/api';

// Fallback data matching seed.sql (used when backend endpoints aren't deployed yet)
const FALLBACK_HOUSEHOLDS: Household[] = [];
const FALLBACK_SPACES: Record<string, StorageArea[]> = {
};

// ------- Types -------
type ProductCategory = 'fruta_verdura' | 'otro';

type Phase =
  | 'select_type'
  | 'camera_product'     // cámara in-app para foto de marca
  | 'detecting_product'  // procesando primera foto
  | 'product_popup'      // popup sobre la foto: categoría + marca + nombre
  | 'fruit_confirm'      // confirmar detección una a una: Sí / No
  | 'fruit_expiry'       // pedir fecha de vencimiento para fruta confirmada
  | 'pkg_detecting'      // spinner mientras el backend procesa foto de producto envasado
  | 'pkg_partial'        // faltan campos — mostrar lo encontrado + pedir otra foto
  | 'pkg_confirm'        // todos los campos (o máx fotos) — confirmar y guardar
  | 'camera_barcode'     // cámara in-app para código/fecha
  | 'detecting_barcode'  // procesando segunda foto (vision AI lee barcode+fecha)
  | 'barcode_popup';     // popup con datos leídos (editables) → guardar

type RestockState = {
  product: InventoryItem;
  step: 'qty' | 'dates';
  qty: string;
  dates: string[];       // fechas ya ingresadas
  currentDate: string;   // input del turno actual
  currentIndex: number;  // índice actual (0-based)
};

// ------- Tab types -------
type AddTab = 'productos' | 'espacios' | 'hogares';

const ADD_TABS: { key: AddTab; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'espacios', label: 'Espacios' },
  { key: 'hogares', label: 'Hogares' },
];

// (Space and Household types come from @/services/api)

// ------- Main Screen -------
export default function AddScreen() {
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [activeTab, setActiveTab] = useState<AddTab>('productos');
  const [phase, setPhase] = useState<Phase>('select_type');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<ProductInfo>({ category: '', brand: '', name: '' });
  const [barcodeInfo, setBarcodeInfo] = useState<BarcodeInfo>({ barcode: '', expiryDate: '' });
  const [detections, setDetections] = useState<Detection[]>([]);
  const [detectionIndex, setDetectionIndex] = useState(0);
  const [fruitExpiry, setFruitExpiry] = useState('');
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [pkgData, setPkgData] = useState<PackagedScanResult>({ name: null, brand: null, expiry_date: null });
  const [pkgPhotoCount, setPkgPhotoCount] = useState(0);
  const [restock, setRestock] = useState<RestockState | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [spaces, setSpaces] = useState<StorageArea[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);
  const [spaceModal, setSpaceModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceEmoji, setNewSpaceEmoji] = useState('');
  const [newSpaceClimate, setNewSpaceClimate] = useState<StorageArea['climate']>('refrigerado');
  const [householdModal, setHouseholdModal] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('');

  React.useEffect(() => {
    fetchInventoryItems(user?.user_id ?? '', undefined, user?.access_token)
      .then(setInventoryItems)
      .catch(() => {})
      .finally(() => setLoadingInventory(false));
    fetchHouseholds(user?.user_id ?? '', user?.access_token)
      .then((hhs) => {
        const list = hhs.length > 0 ? hhs : FALLBACK_HOUSEHOLDS;
        setHouseholds(list);
        setSelectedHouseholdId(list[0].id);
      })
      .catch(() => {
        setHouseholds(FALLBACK_HOUSEHOLDS);
        setSelectedHouseholdId(FALLBACK_HOUSEHOLDS[0].id);
      })
      .finally(() => setLoadingHouseholds(false));
  }, []);

  React.useEffect(() => {
    if (!selectedHouseholdId) return;
    setLoadingSpaces(true);
    fetchStorageAreas(selectedHouseholdId)
      .then((areas) => setSpaces(areas.length > 0 ? areas : (FALLBACK_SPACES[selectedHouseholdId] ?? [])))
      .catch(() => setSpaces(FALLBACK_SPACES[selectedHouseholdId] ?? []))
      .finally(() => setLoadingSpaces(false));
  }, [selectedHouseholdId]);

  async function handleAddSpace() {
    if (!newSpaceName.trim()) return;
    const householdId = selectedHouseholdId || '';
    const emoji = newSpaceEmoji.trim() || undefined;
    try {
      const created = await createStorageArea(householdId, newSpaceName.trim(), newSpaceClimate);
      setSpaces((p) => [...p, { ...created, emoji }]);
      setSpaceModal(false);
    } catch {
      // API unavailable — create locally
      const local: StorageArea = {
        id: `local-${Date.now()}`,
        name: newSpaceName.trim(),
        climate: newSpaceClimate,
        household_id: householdId,
        emoji,
      };
      setSpaces((p) => [...p, local]);
      setSpaceModal(false);
    }
  }

  function handleDeleteSpace(space: StorageArea) {
    Alert.alert('Eliminar espacio', `¿Querés eliminar "${space.name}"? También se eliminarán los productos en ese espacio.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          // Actualiza UI inmediatamente
          setSpaces((p) => p.filter((s) => s.id !== space.id));
          // Persiste en DB en background
          if (!space.id.startsWith('local-')) {
            deleteStorageArea(space.id).catch((err) => {
              const msg = err instanceof Error ? err.message : 'Error';
              Alert.alert('Aviso', `Eliminado localmente pero no en la base de datos: ${msg}`);
            });
          }
        }
      },
    ]);
  }

  async function handleAddHousehold() {
    if (!newHouseholdName.trim()) return;
    const name = newHouseholdName.trim();
    // Cierra el modal y agrega optimistamente
    const optimistic: Household = { id: `local-${Date.now()}`, name, owner_id: user?.user_id ?? '' };
    setHouseholds((p) => [...p, optimistic]);
    if (!selectedHouseholdId) setSelectedHouseholdId(optimistic.id);
    setHouseholdModal(false);
    // Persiste en DB en background, reemplaza el local con el real si funciona
    createHousehold(user?.user_id ?? '', name, user?.access_token)
      .then((created) => {
        setHouseholds((p) => p.map((h) => h.id === optimistic.id ? created : h));
        setSelectedHouseholdId((prev) => prev === optimistic.id ? created.id : prev);
      })
      .catch(() => { /* queda local */ });
  }

  function handleDeleteHousehold(hh: Household) {
    Alert.alert('Eliminar hogar', `¿Querés eliminar "${hh.name}"? También se eliminarán sus espacios y productos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          // Actualiza UI inmediatamente
          setHouseholds((p) => p.filter((h) => h.id !== hh.id));
          setSpaces((p) => p.filter((s) => s.household_id !== hh.id));
          if (selectedHouseholdId === hh.id) {
            const remaining = households.filter((h) => h.id !== hh.id);
            setSelectedHouseholdId(remaining.length > 0 ? remaining[0].id : '');
          }
          // Persiste en DB en background
          if (!hh.id.startsWith('local-')) {
            deleteHousehold(hh.id).catch((err) => {
              const msg = err instanceof Error ? err.message : 'Error';
              Alert.alert('Aviso', `Eliminado localmente pero no en la base de datos: ${msg}`);
            });
          }
        }
      },
    ]);
  }

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
    try {
      if (category === 'fruta_verdura') {
        setPhase('detecting_product');
        const dets = await identifyFruits(photo.uri);
        setDetections(dets);
        setDetectionIndex(0);
        if (dets.length === 0) {
          Alert.alert('Sin resultados', 'No se detectó ninguna fruta o verdura.');
          setPhase('select_type');
        } else {
          setPhase('fruit_confirm');
        }
      } else {
        setPhase('pkg_detecting');
        const result = await scanPackagedProduct(photo.uri);
        const newCount = pkgPhotoCount + 1;
        const merged: PackagedScanResult = {
          name: result.name ?? pkgData.name,
          brand: result.brand ?? pkgData.brand,
          expiry_date: result.expiry_date ?? pkgData.expiry_date,
        };
        setPkgData(merged);
        setPkgPhotoCount(newCount);
        const complete = !!(merged.name && merged.brand && merged.expiry_date);
        setPhase(complete || newCount >= 5 ? 'pkg_confirm' : 'pkg_partial');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert(
        'No se pudo conectar',
        `${msg}\n\nVerificá que el backend esté corriendo en ${API_BASE}.`,
        [{ text: 'OK', onPress: () => setPhase('camera_product') }]
      );
      return;
    }
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

  async function handleSave() {
    if (!barcodeInfo.expiryDate.trim()) {
      Alert.alert('Fecha requerida', 'Ingresá la fecha de vencimiento.');
      return;
    }
    try {
      await addToInventory({
        storage_area_id: spaces[0]?.id ?? '',
        product_name: productInfo.name,
        product_brand: productInfo.brand !== '—' ? productInfo.brand : undefined,
        product_category: productInfo.category,
        barcode: barcodeInfo.barcode || undefined,
        quantity: 1,
        expiry_date: toISODate(barcodeInfo.expiryDate),
      });
      Alert.alert('¡Producto guardado!', `${productInfo.name} fue agregado a tu inventario.`);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('No se pudo guardar', msg);
    }
  }

  function openRestock(product: InventoryItem) {
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

  async function handleRestockDateNext() {
    if (!restock) return;
    if (!restock.currentDate.trim()) {
      Alert.alert('Fecha requerida', 'Ingresá la fecha de vencimiento.');
      return;
    }
    const total = parseInt(restock.qty, 10);
    const newDates = [...restock.dates, restock.currentDate];
    if (newDates.length >= total) {
      try {
        await Promise.all(
          newDates.map((expiry) =>
            addToInventory({
              storage_area_id: spaces[0]?.id ?? '',
              product_name: restock.product.nombre,
              product_brand: restock.product.marca ?? undefined,
              emoji: restock.product.emoji ?? undefined,
              quantity: 1,
              expiry_date: toISODate(expiry),
            })
          )
        );
        setRestock(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        Alert.alert('No se pudo guardar', msg);
      }
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
    setDetections([]);
    setDetectionIndex(0);
    setFruitExpiry('');
    setSelectedDays(null);
    setPkgData({ name: null, brand: null, expiry_date: null });
    setPkgPhotoCount(0);
  }

  function handleFruitConfirmYes() {
    setFruitExpiry('');
    setSelectedDays(null);
    setPhase('fruit_expiry');
  }

  function handleFruitConfirmNo() {
    const next = detectionIndex + 1;
    if (next < detections.length) {
      setDetectionIndex(next);
    } else {
      Alert.alert('Listo', 'No se agregó ningún producto.');
      reset();
    }
  }

  function handleQuickDays(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const iso = date.toISOString().split('T')[0]; // YYYY-MM-DD
    setFruitExpiry(iso);
    setSelectedDays(days);
  }

  async function handleFruitSave() {
    if (!fruitExpiry.trim()) {
      Alert.alert('Fecha requerida', 'Ingresá la fecha de vencimiento o usá los botones rápidos.');
      return;
    }
    const det = detections[detectionIndex];
    const name = getFruitName(det.label);
    try {
      await addToInventory({
        storage_area_id: spaces[0]?.id ?? '',
        product_name: name,
        product_category: 'Frutas y verduras',
        quantity: 1,
        expiry_date: toISODate(fruitExpiry),
      });
      const next = detectionIndex + 1;
      if (next < detections.length) {
        setDetectionIndex(next);
        setPhase('fruit_confirm');
      } else {
        Alert.alert('¡Guardado!', `${name} fue agregado al inventario.`);
        reset();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('No se pudo guardar', msg);
    }
  }

  async function handlePkgSave() {
    if (!pkgData.name?.trim()) {
      Alert.alert('Nombre requerido', 'Ingresá al menos el nombre del producto.');
      return;
    }
    try {
      await addToInventory({
        storage_area_id: spaces[0]?.id ?? '',
        product_name: pkgData.name,
        product_brand: pkgData.brand ?? undefined,
        product_category: 'Producto envasado',
        quantity: 1,
        expiry_date: pkgData.expiry_date ? toISODate(pkgData.expiry_date) : undefined,
      });
      Alert.alert('¡Guardado!', `${pkgData.name} fue agregado al inventario.`);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('No se pudo guardar', msg);
    }
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
  // FRUIT CONFIRM + FRUIT EXPIRY
  // ================================================================
  if (phase === 'fruit_confirm' || phase === 'fruit_expiry') {
    const det = detections[detectionIndex];
    const fruitName = det ? getFruitName(det.label) : '';
    const confidencePct = det ? Math.round(det.confidence * 100) : 0;
    const total = detections.length;

    return (
      <View style={styles.fullscreen}>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photoBackground} resizeMode="cover" />}
        <View style={styles.photoDim} />

        {/* ---- Confirm screen ---- */}
        {phase === 'fruit_confirm' && (
          <View style={styles.modalOverlay}>
            <View style={styles.card}>
              {total > 1 && (
                <Text style={[styles.aiHint, { textAlign: 'right' }]}>
                  {detectionIndex + 1} de {total}
                </Text>
              )}
              <View style={styles.successRow}>
                <Text style={styles.cardTitle}>¿Qué detectamos?</Text>
              </View>
              <View style={[styles.detectedBox, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ fontSize: 48 }}>🍓</Text>
                <Text style={[styles.detectedValue, { fontSize: 22, marginTop: 8 }]}>{fruitName}</Text>
                <Text style={[styles.aiHint, { marginTop: 4 }]}>{confidencePct}% de confianza</Text>
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleFruitConfirmNo}>
                  <Ionicons name="close-circle-outline" size={16} color="#888" />
                  <Text style={styles.secondaryBtnText}>No es esto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleFruitConfirmYes}>
                  <Text style={styles.primaryBtnText}>Sí, agregar</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ---- Expiry screen ---- */}
        {phase === 'fruit_expiry' && (
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.card}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
                <Text style={styles.cardTitle}>{fruitName}</Text>
              </View>

              {/* Quick-pick buttons */}
              <View>
                <Text style={styles.fieldLabel}>¿Cuántos días le quedan?</Text>
                <View style={styles.expiryBtnRow}>
                  {([1, 3, 5] as const).map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.expiryBtn, selectedDays === days && styles.expiryBtnSelected]}
                      onPress={() => handleQuickDays(days)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.expiryBtnText, selectedDays === days && styles.expiryBtnTextSelected]}>
                        +{days} {days === 1 ? 'día' : 'días'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {fruitExpiry !== '' && (
                  <Text style={styles.expirySelected}>
                    Vence: {fruitExpiry}
                  </Text>
                )}
              </View>

              {/* Manual input */}
              <View>
                <Text style={styles.fieldLabel}>
                  O ingresá la fecha <Text style={styles.optional}>(DD/MM/AAAA)</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={fruitExpiry}
                  onChangeText={(v) => { setFruitExpiry(v); setSelectedDays(null); }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#BBB"
                  // keyboardType="numeric"
                />
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('fruit_confirm')}>
                  <Ionicons name="arrow-back" size={16} color="#888" />
                  <Text style={styles.secondaryBtnText}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleFruitSave}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    );
  }

  // ================================================================
  // PACKAGED PRODUCT — detecting / partial / confirm
  // ================================================================
  if (phase === 'pkg_detecting' || phase === 'pkg_partial' || phase === 'pkg_confirm') {
    const FIELDS: { key: keyof PackagedScanResult; label: string }[] = [
      { key: 'name', label: 'Nombre' },
      { key: 'brand', label: 'Marca' },
      { key: 'expiry_date', label: 'Fecha de vencimiento' },
    ];

    return (
      <View style={styles.fullscreen}>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.photoBackground} resizeMode="cover" />}
        <View style={styles.photoDim} />

        {/* ---- Spinner ---- */}
        {phase === 'pkg_detecting' && (
          <View style={styles.detectingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.detectingText}>
              Analizando producto… ({pkgPhotoCount + 1}/5)
            </Text>
          </View>
        )}

        {/* ---- Partial results ---- */}
        {phase === 'pkg_partial' && (
          <View style={styles.modalOverlay}>
            <View style={styles.card}>
              <View style={styles.successRow}>
                <Ionicons name="scan-outline" size={26} color="#A8CFEE" />
                <Text style={styles.cardTitle}>Lo que encontramos</Text>
              </View>
              <Text style={[styles.aiHint, { textAlign: 'right' }]}>
                Foto {pkgPhotoCount} de 5
              </Text>
              <View style={styles.detectedBox}>
                {FIELDS.map((f, i) => {
                  const found = pkgData[f.key] !== null;
                  return (
                    <React.Fragment key={f.key}>
                      {i > 0 && <View style={styles.detectedDivider} />}
                      <View style={styles.detectedRow}>
                        <Text style={styles.detectedLabel}>{f.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons
                            name={found ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={found ? '#27AE60' : '#CCC'}
                          />
                          <Text style={[styles.detectedValue, !found && { color: '#CCC' }]}>
                            {found ? String(pkgData[f.key]) : 'Falta'}
                          </Text>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('pkg_confirm')}>
                  <Text style={styles.secondaryBtnText}>Confirmar así</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={() => setPhase('camera_product')}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Otra foto</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ---- Confirm + edit ---- */}
        {phase === 'pkg_confirm' && (
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.card}>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={28} color="#27AE60" />
                <Text style={styles.cardTitle}>Confirmá los datos</Text>
              </View>
              <Text style={styles.aiHint}>
                Corregí cualquier campo antes de guardar.
              </Text>

              <View>
                <Text style={styles.fieldLabel}>Nombre <Text style={styles.optional}>(requerido)</Text></Text>
                <TextInput
                  style={styles.input}
                  value={pkgData.name ?? ''}
                  onChangeText={(v) => setPkgData((p) => ({ ...p, name: v || null }))}
                  placeholder="Ej: Leche Entera"
                  placeholderTextColor="#BBB"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Marca</Text>
                <TextInput
                  style={styles.input}
                  value={pkgData.brand ?? ''}
                  onChangeText={(v) => setPkgData((p) => ({ ...p, brand: v || null }))}
                  placeholder="Ej: La Serenísima"
                  placeholderTextColor="#BBB"
                />
              </View>

              <View>
                <Text style={styles.fieldLabel}>Fecha de vencimiento</Text>
                <TextInput
                  style={styles.input}
                  value={pkgData.expiry_date ?? ''}
                  onChangeText={(v) => setPkgData((p) => ({ ...p, expiry_date: v || null }))}
                  placeholder="DD/MM/AAAA o YYYY-MM-DD"
                  placeholderTextColor="#BBB"
                  // keyboardType="numeric"
                />
              </View>

              <View style={styles.btnRow}>
                {pkgPhotoCount < 5 && (
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('camera_product')}>
                    <Ionicons name="camera-outline" size={16} color="#888" />
                    <Text style={styles.secondaryBtnText}>Otra foto</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handlePkgSave}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
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
              {category === 'fruta_verdura' ? (
                <>
                  <View>
                    <Text style={styles.fieldLabel}>¿Cuándo vence?</Text>
                    <View style={styles.expiryBtnRow}>
                      {[1, 3, 5].map((days) => {
                        const d = new Date();
                        d.setDate(d.getDate() + days);
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const selected = barcodeInfo.expiryDate === iso;
                        return (
                          <TouchableOpacity
                            key={days}
                            style={[styles.expiryBtn, selected && styles.expiryBtnSelected]}
                            onPress={() => setBarcodeInfo((p) => ({ ...p, expiryDate: iso }))}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.expiryBtnText, selected && styles.expiryBtnTextSelected]}>
                              +{days} {days === 1 ? 'día' : 'días'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {barcodeInfo.expiryDate ? (
                      <Text style={styles.expirySelected}>Vence: {barcodeInfo.expiryDate}</Text>
                    ) : null}
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('camera_product')}>
                      <Ionicons name="camera-outline" size={16} color="#888" />
                      <Text style={styles.secondaryBtnText}>Retomar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.primaryBtn, styles.btnFlex]} onPress={handleSave}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.primaryBtnText}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
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
                </>
              )}
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
                <View style={styles.expiryBtnRow}>
                  {[1, 3, 5].map((days) => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const selected = barcodeInfo.expiryDate === iso;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.expiryBtn, selected && styles.expiryBtnSelected]}
                        onPress={() => setBarcodeInfo((p) => ({ ...p, expiryDate: iso }))}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.expiryBtnText, selected && styles.expiryBtnTextSelected]}>
                          +{days} {days === 1 ? 'día' : 'días'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {barcodeInfo.expiryDate ? (
                  <Text style={styles.expirySelected}>Vence: {barcodeInfo.expiryDate}</Text>
                ) : null}
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

      {/* ---- 3-tab bar: Productos / Espacios / Hogares ---- */}
      <View style={styles.tabBar}>
        {ADD_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ---- Productos tab ---- */}
        {activeTab === 'productos' && (
          <>
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

            {loadingInventory ? (
              <ActivityIndicator size="small" color="#888" style={{ marginTop: 12 }} />
            ) : inventoryItems.length === 0 ? (
              <Text style={{ color: '#AAA', textAlign: 'center', marginTop: 12 }}>
                No hay productos en el inventario todavía.
              </Text>
            ) : (
              inventoryItems.map((product) => (
                <TouchableOpacity key={product.id} style={styles.categoryCard} onPress={() => openRestock(product)} activeOpacity={0.8}>
                  <View style={[styles.categoryIconWrap, { backgroundColor: '#E8F4FF' }]}>
                    <Text style={styles.categoryEmoji}>{product.emoji ?? '📦'}</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryTitle}>{product.nombre}</Text>
                    <Text style={styles.categorySubtitle}>{product.marca ?? 'Tocá para hacer restock'}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={26} color="#A8CFEE" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* ---- Espacios tab ---- */}
        {activeTab === 'espacios' && (
          <>
            <Text style={styles.sectionTitle}>Hogar</Text>
            <Text style={styles.sectionSubtitle}>¿A qué hogar pertenecen estos espacios?</Text>
            <View style={styles.householdSelector}>
              {households.map((hh) => (
                <TouchableOpacity
                  key={hh.id}
                  style={[styles.householdChip, selectedHouseholdId === hh.id && styles.householdChipActive]}
                  onPress={() => setSelectedHouseholdId(hh.id)}
                >
                  <Text style={styles.householdChipEmoji}>🏠</Text>
                  <Text style={[styles.householdChipText, selectedHouseholdId === hh.id && styles.householdChipTextActive]}>{hh.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Espacios de almacenamiento</Text>
            <Text style={styles.sectionSubtitle}>Organizá tus productos por área del hogar.</Text>
            {loadingSpaces ? (
              <ActivityIndicator size="small" color="#888" style={{ marginTop: 12 }} />
            ) : spaces.map((space) => (
              <View key={space.id} style={styles.categoryCard}>
                <View style={[styles.categoryIconWrap, { backgroundColor: '#E8F4FF' }]}>
                  <Text style={styles.categoryEmoji}>{space.emoji || CLIMATE_EMOJI[space.climate] || '📦'}</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{space.name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSpace(space)}>
                  <Ionicons name="trash-outline" size={20} color="#E07070" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.categoryCard} onPress={() => { setNewSpaceName(''); setNewSpaceEmoji(''); setNewSpaceClimate('refrigerado'); setSpaceModal(true); }} activeOpacity={0.8}>
              <View style={[styles.categoryIconWrap, { backgroundColor: '#DFF5E3' }]}>
                <Ionicons name="add" size={26} color="#27AE60" />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>Agregar espacio</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* ---- Hogares tab ---- */}
        {activeTab === 'hogares' && (
          <>
            <Text style={styles.sectionTitle}>Mis hogares</Text>
            <Text style={styles.sectionSubtitle}>Gestioná los hogares en los que participás.</Text>
            {loadingHouseholds ? (
              <ActivityIndicator size="small" color="#888" style={{ marginTop: 12 }} />
            ) : households.map((hh) => (
              <View key={hh.id} style={styles.categoryCard}>
                <View style={[styles.categoryIconWrap, { backgroundColor: '#F0F0F0' }]}>
                  <Text style={styles.categoryEmoji}>🏠</Text>
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{hh.name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteHousehold(hh)}>
                  <Ionicons name="trash-outline" size={20} color="#E07070" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.categoryCard} onPress={() => { setNewHouseholdName(''); setHouseholdModal(true); }} activeOpacity={0.8}>
              <View style={[styles.categoryIconWrap, { backgroundColor: '#DFF5E3' }]}>
                <Ionicons name="add" size={26} color="#27AE60" />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>Agregar hogar</Text>
              </View>
            </TouchableOpacity>
          </>
        )}

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
              <Text style={styles.productEmoji}>{restock?.product.emoji ?? '📦'}</Text>
              <View>
                <Text style={styles.cardTitle}>{restock?.product.nombre}</Text>
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
                  onChangeText={(raw) => {
                    const digits = raw.replace(/\D/g, '').slice(0, 8);
                    let formatted = digits;
                    if (digits.length > 4) formatted = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
                    else if (digits.length > 2) formatted = `${digits.slice(0,2)}/${digits.slice(2)}`;
                    setRestock((p) => p ? { ...p, currentDate: formatted } : p);
                  }}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#BBB"
                  // keyboardType="numeric"
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
                (() => {
                  const _d = restock?.currentDate ?? '';
                  const _m = _d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                  const isValidDate = !!_m && +_m[2] >= 1 && +_m[2] <= 12 && +_m[1] >= 1 && +_m[1] <= 31 && +_m[3] >= 2000;
                  return (
                    <TouchableOpacity
                      style={[styles.primaryBtn, styles.btnFlex, !isValidDate && styles.btnDisabled]}
                      onPress={handleRestockDateNext}
                      disabled={!isValidDate}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.primaryBtnText}>
                        {restock && restock.dates.length + 1 >= parseInt(restock.qty, 10) ? 'Guardar' : 'Siguiente'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal agregar espacio */}
      <Modal visible={spaceModal} transparent animationType="slide" onRequestClose={() => setSpaceModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nuevo espacio</Text>
            <Text style={styles.fieldLabel}>Tipo</Text>
            <View style={styles.climateRow}>
              {(['refrigerado', 'seco', 'congelado'] as StorageArea['climate'][]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.climateBtn, newSpaceClimate === c && styles.climateBtnActive]}
                  onPress={() => setNewSpaceClimate(c)}
                >
                  <Text style={styles.climateEmoji}>{CLIMATE_EMOJI[c]}</Text>
                  <Text style={[styles.climateLabel, newSpaceClimate === c && styles.climateLabelActive]}>
                    {c === 'refrigerado' ? 'Frío' : c === 'seco' ? 'Seco' : 'Congelado'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput style={styles.input} value={newSpaceName} onChangeText={setNewSpaceName} placeholder="Ej: Freezer" placeholderTextColor="#BBB" autoFocus />
            <Text style={styles.fieldLabel}>Emoji <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput style={styles.input} value={newSpaceEmoji} onChangeText={setNewSpaceEmoji} placeholder="🧊" placeholderTextColor="#BBB" />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSpaceModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.btnFlex, !newSpaceName.trim() && styles.btnDisabled]}
                disabled={!newSpaceName.trim()}
                onPress={handleAddSpace}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal agregar hogar */}
      <Modal visible={householdModal} transparent animationType="slide" onRequestClose={() => setHouseholdModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nuevo hogar</Text>
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput style={styles.input} value={newHouseholdName} onChangeText={setNewHouseholdName} placeholder="Ej: Casa de verano" placeholderTextColor="#BBB" autoFocus />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setHouseholdModal(false)}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.btnFlex, !newHouseholdName.trim() && styles.btnDisabled]}
                disabled={!newHouseholdName.trim()}
                onPress={handleAddHousehold}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Agregar</Text>
              </TouchableOpacity>
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
    borderColor: '#A8CFEE',
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
    borderColor: '#A8CFEE',
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

  // Expiry quick-select buttons
  expiryBtnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  expiryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDD',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  expiryBtnSelected: {
    borderColor: '#A8CFEE',
    backgroundColor: '#E8F4FD',
  },
  expiryBtnText: { fontSize: 14, color: '#888', fontWeight: '600' },
  expiryBtnTextSelected: { color: '#3A7CA5' },
  expirySelected: { fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3A7CA5',
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
    borderColor: '#999',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
  },
  secondaryBtnText: { fontSize: 14, color: '#555', fontWeight: '600' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#F0F0F0',
  },
  tabItemActive: {
    backgroundColor: '#A8CFEE',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabLabelActive: {
    color: '#fff',
  },

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
  btnDisabled: { backgroundColor: '#C8E3F5', opacity: 0.6 },
  householdSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  householdChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  householdChipActive: { backgroundColor: '#A8CFEE', borderColor: '#A8CFEE' },
  householdChipEmoji: { fontSize: 16 },
  householdChipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  householdChipTextActive: { color: '#fff', fontWeight: '700' },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A8CFEE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  climateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  climateBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    gap: 4,
  },
  climateBtnActive: { borderColor: '#A8CFEE', backgroundColor: '#E8F4FF' },
  climateEmoji: { fontSize: 22 },
  climateLabel: { fontSize: 11, color: '#888' },
  climateLabelActive: { color: '#2C7BB5', fontWeight: '700' },
});
