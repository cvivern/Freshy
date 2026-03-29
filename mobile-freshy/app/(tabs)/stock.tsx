import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';
import type { HogarOption } from '@/components/AppHeaderConEleccionHogar';
import {
  fetchInventory,
  fetchHouseholds,
  fetchStorageAreas,
  calcEstado,
  deleteInventoryItem,
  updateInventoryItem,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { InventoryItemResponse } from '@/services/api';
import ProductActionsMenu from '@/components/ProductActionsMenu';

// ------- Types -------
type CartButtonState = 'idle' | 'loading' | 'added' | 'error';

type StockItem = {
  id: string;
  emoji: string;
  name: string;
  brand: string;
  space: string;
  expiryDate: string;
  daysLeft: number;
  shelfLife: number;
  estado: 'fresco' | 'por_vencer' | 'vencido';
};

type ShoppingListItem = {
  id: string;
  emoji: string;
  name: string;
  brand: string;
  quantity: number;
};

// ------- Mock addToShoppingList -------
type AddToShoppingListParams = {
  householdId: string;
  inventoryItemId: string;
  name: string;
  brand: string;
  emoji: string;
  accessToken?: string;
};


// ------- Helpers -------
function calcDaysLeft(fechaVencimiento: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(fechaVencimiento);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(fechaVencimiento: string): string {
  const [year, month, day] = fechaVencimiento.split('-');
  return `${day}/${month}/${year}`;
}

function shelfLifeFromEstado(estado: StockItem['estado']): number {
  if (estado === 'vencido') return 7;
  if (estado === 'por_vencer') return 30;
  return 365;
}

function mapToStockItem(item: InventoryItemResponse): StockItem {
  const daysLeft = item.fecha_vencimiento != null ? calcDaysLeft(item.fecha_vencimiento) : 999;
  const estado = calcEstado(item.fecha_vencimiento);
  return {
    id: item.id,
    emoji: item.emoji ?? '📦',
    name: item.nombre,
    brand: item.marca ?? '',
    space: item.categoria ?? 'General',
    expiryDate: item.fecha_vencimiento ? formatDate(item.fecha_vencimiento) : 'Sin fecha',
    daysLeft,
    shelfLife: shelfLifeFromEstado(estado),
    estado,
  };
}

function getStatus(estado: StockItem['estado']): {
  label: string; bg: string; textColor: string; borderColor: string;
} {
  if (estado === 'vencido')    return { label: 'Vencido',       bg: '#FDDEDE', textColor: '#C0392B', borderColor: '#E07070' };
  if (estado === 'por_vencer') return { label: 'Por vencer',    bg: '#FFF3CD', textColor: '#996600', borderColor: '#E0C050' };
  return                              { label: 'En buen estado', bg: '#DFF5E3', textColor: '#27AE60', borderColor: '#60B870' };
}

function calcStats(items: StockItem[]) {
  return {
    total:      items.length,
    vencidos:   items.filter((i) => i.estado === 'vencido').length,
    porVencer:  items.filter((i) => i.estado === 'por_vencer').length,
    bienEstado: items.filter((i) => i.estado === 'fresco').length,
  };
}


// ------- Cart Button -------
function CartButton({ state, onPress }: { state: CartButtonState; onPress: () => void }) {
  const isDisabled = state === 'loading' || state === 'added';
  const bgColor     = state === 'added' ? '#DFF5E3' : state === 'error' ? '#FDDEDE' : '#E8F4FF';
  const borderColor = state === 'added' ? '#60B870' : state === 'error' ? '#E07070' : '#A8CFEE';
  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    state === 'added' ? 'checkmark-circle' : state === 'error' ? 'alert-circle-outline' : 'cart-outline';
  const iconColor = state === 'added' ? '#27AE60' : state === 'error' ? '#C0392B' : '#5B9BD5';

  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} style={[styles.cartButton, { backgroundColor: bgColor, borderColor }]} activeOpacity={0.75}>
      {state === 'loading'
        ? <ActivityIndicator size="small" color="#5B9BD5" />
        : <Ionicons name={iconName} size={20} color={iconColor} />}
    </TouchableOpacity>
  );
}

// ------- Stat Card -------
function StatCard({ value, label, iconName, iconColor, borderColor, bgColor }: {
  value: number; label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string; borderColor: string; bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ------- Product Card -------
function ProductCard({ item, cartState, onAddToCart, token, onDeleted, onUpdated }: {
  item: StockItem; cartState: CartButtonState; onAddToCart: () => void;
  token?: string | null;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, fields: { nombre?: string; marca?: string; fecha_vencimiento?: string }) => void;
}) {
  const status = getStatus(item.estado);
  const progress = Math.min(1, Math.max(0, (item.shelfLife - item.daysLeft) / item.shelfLife));

  return (
    <View style={[styles.productCard, { borderColor: status.borderColor }]}>
      <View style={styles.productTopRow}>
        <Text style={styles.productEmoji}>{item.emoji}</Text>
        <View style={styles.productTopRight}>
          <View style={styles.spaceChip}>
            <Text style={styles.spaceChipText}>{item.space}</Text>
          </View>
          <CartButton state={cartState} onPress={onAddToCart} />
          <ProductActionsMenu
            item={{ id: item.id, nombre: item.name, marca: item.brand, fecha_vencimiento: item.expiryDate, emoji: item.emoji }}
            token={token}
            onDeleted={onDeleted}
            onUpdated={(id, fields) => onUpdated(id, fields as any)}
          />
        </View>
      </View>
      <Text style={styles.productName}>{item.name}</Text>
      {!!item.brand && <Text style={styles.productBrand}>{item.brand}</Text>}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: status.borderColor }]} />
      </View>
      <View style={styles.productFooter}>
        <View>
          <Text style={styles.expiryLabel}>Vencimiento</Text>
          <Text style={styles.expiryDate}>{item.expiryDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ------- Agregar Otros Form -------
function AgregarOtrosForm({ onAdd }: { onAdd: (item: Omit<ShoppingListItem, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [formHeight, setFormHeight] = useState(0); // ← hauteur mesurée
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.spring(anim, { toValue, useNativeDriver: false, tension: 80, friction: 12 }).start();
    setOpen((prev) => !prev);
  };

  const animatedHeight = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, formHeight > 0 ? formHeight + 10 : 0], // +10 pour le marginTop
  });
  const formOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const handleCantidadChange = (delta: number) => {
    setCantidad((prev) => String(Math.max(1, (parseInt(prev, 10) || 1) + delta)));
  };

  const handleAdd = () => {
    if (!nombre.trim()) return;
    const qty = Math.max(1, parseInt(cantidad, 10) || 1);
    onAdd({ emoji: '🛒', name: nombre.trim(), brand: marca.trim(), quantity: qty });
    setNombre('');
    setMarca('');
    setCantidad('1');
    toggle();
  };

  return (
    <View style={formStyles.wrapper}>
      <TouchableOpacity onPress={toggle} style={formStyles.triggerButton} activeOpacity={0.8}>
        <Ionicons name={open ? 'close-circle-outline' : 'add-circle-outline'} size={20} color="#5B9BD5" />
        <Text style={formStyles.triggerText}>{open ? 'Cancelar' : 'Agregar otros'}</Text>
      </TouchableOpacity>

      <Animated.View style={{ height: animatedHeight, opacity: formOpacity, overflow: 'hidden' }}>
        {/* View invisible pour mesurer la hauteur réelle */}
        <View
          onLayout={(e) => setFormHeight(e.nativeEvent.layout.height)}
          style={formStyles.formInner}
        >
          <Text style={formStyles.formTitle}>Producto personalizado</Text>
          <View style={formStyles.field}>
            <Text style={formStyles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={formStyles.input}
              placeholder="Ej: Arroz, Leche..."
              placeholderTextColor="#C0C0C0"
              value={nombre}
              onChangeText={setNombre}
              returnKeyType="next"
            />
          </View>
          <View style={formStyles.field}>
            <Text style={formStyles.fieldLabel}>Marca</Text>
            <TextInput
              style={formStyles.input}
              placeholder="Opcional"
              placeholderTextColor="#C0C0C0"
              value={marca}
              onChangeText={setMarca}
              returnKeyType="done"
            />
          </View>
          <View style={formStyles.bottomRow}>
            <View style={formStyles.cantidadGroup}>
              <Text style={formStyles.fieldLabel}>Cantidad</Text>
              <View style={formStyles.cantidadControl}>
                <TouchableOpacity onPress={() => handleCantidadChange(-1)} style={formStyles.cantidadBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="remove" size={16} color="#5B9BD5" />
                </TouchableOpacity>
                <TextInput
                  style={formStyles.cantidadInput}
                  value={cantidad}
                  onChangeText={(v) => setCantidad(v.replace(/[^0-9]/g, '') || '1')}
                  keyboardType="numeric"
                  maxLength={3}
                  textAlign="center"
                />
                <TouchableOpacity onPress={() => handleCantidadChange(+1)} style={formStyles.cantidadBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="add" size={16} color="#5B9BD5" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleAdd}
              style={[formStyles.addButton, !nombre.trim() && formStyles.addButtonDisabled]}
              activeOpacity={0.8}
              disabled={!nombre.trim()}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={formStyles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const formStyles = StyleSheet.create({
  wrapper: { marginTop: 6, marginBottom: 4 },
  triggerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 1.5, borderColor: '#A8CFEE', borderRadius: 14, borderStyle: 'dashed',
    backgroundColor: '#F5F9FF',
  },
  triggerText: { fontSize: 15, fontWeight: '600', color: '#5B9BD5' },
  formInner: {
    marginTop: 10, padding: 16, gap: 12,
    backgroundColor: '#F5F9FF', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#D0E8F8',
  },
  formTitle: { fontSize: 13, fontWeight: '700', color: '#7A9BBD', letterSpacing: 0.5, textTransform: 'uppercase' },
  field: { gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9AACBC', letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8ECF8',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1A1A1A',
  },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 2 },
  cantidadGroup: { gap: 5 },
  cantidadControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D8ECF8', borderRadius: 10, overflow: 'hidden',
  },
  cantidadBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5FF' },
  cantidadInput: { width: 44, height: 40, fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  addButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#5B9BD5', borderRadius: 10, paddingVertical: 12,
  },
  addButtonDisabled: { backgroundColor: '#B8D4ED' },
  addButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ------- Suggestions Section -------
function SuggestionsSection({
  stockItems,
  shoppingList,
  onAddSuggestion,
}: {
  stockItems: StockItem[];
  shoppingList: ShoppingListItem[];
  onAddSuggestion: (item: StockItem) => void;
}) {
  const alreadyInList = new Set(shoppingList.map((i) => i.id));
  const suggestions = stockItems.filter(
    (i) => (i.estado === 'vencido' || i.estado === 'por_vencer') && !alreadyInList.has(i.id)
  );

  if (suggestions.length === 0) return null;

  return (
    <View style={suggStyles.container}>
      <View style={suggStyles.header}>
        <View style={suggStyles.iconWrap}>
          <Ionicons name="bulb-outline" size={16} color="#E07820" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={suggStyles.title}>Sugerencias para reponer</Text>
          <Text style={suggStyles.subtitle}>Productos vencidos o próximos a vencer en tu stock</Text>
        </View>
      </View>

      {suggestions.map((item, index) => {
        const isVencido = item.estado === 'vencido';
        const isLast = index === suggestions.length - 1;
        return (
          <View key={item.id} style={[suggStyles.row, !isLast && suggStyles.rowBorder]}>
            <Text style={suggStyles.emoji}>{item.emoji}</Text>
            <View style={suggStyles.info}>
              <Text style={suggStyles.name}>{item.name}</Text>
              {!!item.brand && <Text style={suggStyles.brand}>{item.brand}</Text>}
              <View style={[suggStyles.badge, isVencido ? suggStyles.badgeVencido : suggStyles.badgePorVencer]}>
                <Text style={[suggStyles.badgeText, { color: isVencido ? '#C0392B' : '#996600' }]}>
                  {isVencido ? '⚠ Vencido' : `⏱ Vence en ${item.daysLeft} día${item.daysLeft !== 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => onAddSuggestion(item)} style={suggStyles.addBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add" size={20} color="#5B9BD5" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const suggStyles = StyleSheet.create({
  container: { marginTop: 24, borderWidth: 1.5, borderColor: '#F0C060', borderRadius: 16, backgroundColor: '#FFFDF5', overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0E8C0',
    backgroundColor: '#FFF8E6',
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFE8B0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#7A5200' },
  subtitle: { fontSize: 12, color: '#A07020', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0E8C0' },
  emoji: { fontSize: 26 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '700', color: '#222' },
  brand: { fontSize: 12, color: '#4ABCB0', fontWeight: '500' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeVencido: { backgroundColor: '#FDDEDE' },
  badgePorVencer: { backgroundColor: '#FFF3CD' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E8F4FF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#A8CFEE',
  },
});

// ------- Shopping List Screen -------
function ListaDeComprasScreen({
  items,
  stockItems,
  onRemove,
  onChangeQuantity,
  onAddManual,
  onAddSuggestion,
}: {
  items: ShoppingListItem[];
  stockItems: StockItem[];
  onRemove: (id: string) => void;
  onChangeQuantity: (id: string, delta: number) => void;
  onAddManual: (item: Omit<ShoppingListItem, 'id'>) => void;
  onAddSuggestion: (item: StockItem) => void;
}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {items.length === 0 ? (
        <View style={styles.placeholderContainer}>
          <Ionicons name="cart-outline" size={64} color="#C8DCEF" />
          <Text style={styles.placeholderTitle}>Lista de compras</Text>
          <Text style={styles.placeholderText}>Añade productos desde el Stock con el botón 🛒.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Lista de compras</Text>
          <Text style={styles.listaSubtitle}>{items.length} producto{items.length !== 1 ? 's' : ''}</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.listaCard}>
              <Text style={styles.listaEmoji}>{item.emoji}</Text>
              <View style={styles.listaInfo}>
                <Text style={styles.listaName}>{item.name}</Text>
                {!!item.brand && <Text style={styles.listaBrand}>{item.brand}</Text>}
              </View>
              <View style={styles.qtyControl}>
                <TouchableOpacity onPress={() => onChangeQuantity(item.id, -1)} style={styles.qtyButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="remove" size={16} color="#5B9BD5" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => onChangeQuantity(item.id, +1)} style={styles.qtyButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="add" size={16} color="#5B9BD5" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.listaRemoveButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color="#C0392B" />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <AgregarOtrosForm onAdd={onAddManual} />
      <SuggestionsSection stockItems={stockItems} shoppingList={items} onAddSuggestion={onAddSuggestion} />
    </ScrollView>
  );
}

// ------- Main Screen -------
type StockTab = 'stock' | 'lista_compras' | 'recetas';

const STOCK_TABS: { key: StockTab; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'lista_compras', label: 'Lista de compras' },
  { key: 'recetas', label: 'Recetas' },
];

export default function StockScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StockTab>('stock');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'buen_estado' | 'por_vencer' | 'vencidos'>('todos');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [storageAreaId, setStorageAreaId] = useState('');

  const [cartStates, setCartStates] = useState<Record<string, CartButtonState>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Three-dot menu state
  const [menuItem, setMenuItem] = useState<StockItem | null>(null);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadInventory(areaId: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory(user?.user_id ?? '', areaId, user?.access_token);
      const sorted = [...data].sort((a, b) => {
        const da = a.entry_date ?? '';
        const db = b.entry_date ?? '';
        return db.localeCompare(da); // más nuevo primero
      });
      setItems(sorted.map(mapToStockItem));
      if (!isRefresh) setCartStates({});
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el inventario');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }

  const handleRefresh = useCallback(() => {
    if (storageAreaId) loadInventory(storageAreaId, true);
  }, [storageAreaId]);

  const handleDelete = useCallback((item: StockItem) => {
    setMenuItem(null);
    Alert.alert(
      'Eliminar producto',
      `¿Eliminás "${item.name}" del inventario?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteInventoryItem(item.id, user?.access_token);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el producto.');
            }
          },
        },
      ],
    );
  }, [user?.access_token]);

  const openEdit = useCallback((item: StockItem) => {
    setMenuItem(null);
    setEditItem(item);
    setEditName(item.name);
    // Convert DD/MM/YYYY → DD/MM/YYYY (already formatted) for display
    setEditExpiry(item.expiryDate === 'Sin fecha' ? '' : item.expiryDate);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      // Convert DD/MM/YYYY → YYYY-MM-DD for the API
      let isoExpiry: string | undefined;
      if (editExpiry.trim()) {
        const parts = editExpiry.trim().split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          isoExpiry = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
      await updateInventoryItem(
        editItem.id,
        { product_name: editName.trim() || undefined, expiry_date: isoExpiry },
        user?.access_token,
      );
      setItems((prev) => prev.map((i) => {
        if (i.id !== editItem.id) return i;
        const newExpiry = isoExpiry ? isoExpiry : i.expiryDate;
        const daysLeft = isoExpiry ? calcDaysLeft(isoExpiry) : i.daysLeft;
        return {
          ...i,
          name: editName.trim() || i.name,
          expiryDate: isoExpiry
            ? (() => { const [y2, m2, d2] = isoExpiry.split('-'); return `${d2}/${m2}/${y2}`; })()
            : i.expiryDate,
          daysLeft,
          estado: calcEstado(isoExpiry ?? (i.expiryDate !== 'Sin fecha' ? i.expiryDate : null)) as StockItem['estado'],
        };
      }));
      setEditItem(null);
    } catch {
      Alert.alert('Error', 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }, [editItem, editName, editExpiry, user?.access_token]);

  const handleAddToCart = useCallback(async (item: StockItem) => {
    if (shoppingList.some((s) => s.id === item.id)) {
      setCartStates((prev) => ({ ...prev, [item.id]: 'added' }));
      return;
    }
    setCartStates((prev) => ({ ...prev, [item.id]: 'loading' }));
    try {
      await addToShoppingList({
        householdId: selectedHouseholdId,
        inventoryItemId: item.id,
        name: item.name,
        brand: item.brand,
        emoji: item.emoji,
        accessToken: user?.access_token,
      });
      setShoppingList((prev) => [
        ...prev,
        { id: item.id, emoji: item.emoji, name: item.name, brand: item.brand, quantity: 1 },
      ]);
      setCartStates((prev) => ({ ...prev, [item.id]: 'added' }));
    } catch {
      setCartStates((prev) => ({ ...prev, [item.id]: 'error' }));
      setTimeout(() => {
        setCartStates((prev) => ({ ...prev, [item.id]: 'idle' }));
      }, 2000);
    }
  }, [selectedHouseholdId, user?.access_token, shoppingList]);

  const handleRemoveFromList = useCallback((id: string) => {
    setShoppingList((prev) => prev.filter((i) => i.id !== id));
    setCartStates((prev) => ({ ...prev, [id]: 'idle' }));
  }, []);

  const handleChangeQuantity = useCallback((id: string, delta: number) => {
    setShoppingList((prev) => {
      const next = prev
        .map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0);
      if (!next.find((i) => i.id === id)) {
        setCartStates((cs) => ({ ...cs, [id]: 'idle' }));
      }
      return next;
    });
  }, []);

  const handleItemDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleItemUpdated = useCallback((id: string, fields: { nombre?: string; marca?: string; fecha_vencimiento?: string }) => {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      return {
        ...i,
        name: fields.nombre ?? i.name,
        brand: fields.marca ?? i.brand,
        expiryDate: fields.fecha_vencimiento ? fields.fecha_vencimiento.split('-').reverse().join('/') : i.expiryDate,
      };
    }));
  }, []);

  const handleAddManual = useCallback((item: Omit<ShoppingListItem, 'id'>) => {
    const id = `manual_${Date.now()}`;
    setShoppingList((prev) => [...prev, { ...item, id }]);
  }, []);

  const handleAddSuggestion = useCallback((item: StockItem) => {
    if (shoppingList.some((s) => s.id === item.id)) return;
    setShoppingList((prev) => [
      ...prev,
      { id: item.id, emoji: item.emoji, name: item.name, brand: item.brand, quantity: 1 },
    ]);
    setCartStates((prev) => ({ ...prev, [item.id]: 'added' }));
  }, [shoppingList]);

  useEffect(() => {
    fetchHouseholds(user?.user_id ?? '', user?.access_token).then((hhs) => {
      if (hhs.length > 0) {
        const opts: HogarOption[] = hhs.map(h => ({ id: h.id, name: h.name }));
        setHogares(opts);
        setSelectedHouseholdId(opts[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchStorageAreas(selectedHouseholdId).then((areas) => {
      if (areas.length > 0) {
        setStorageAreaId(areas[0].id);
      } else {
        setStorageAreaId('');
        setItems([]);
        setLoading(false);
      }
    }).catch(() => {
      setStorageAreaId('');
      setItems([]);
      setLoading(false);
    });
  }, [selectedHouseholdId]);

  useEffect(() => {
    if (!storageAreaId) return;
    loadInventory(storageAreaId);
  }, [storageAreaId]);

  const stats = calcStats(items);

  const filtered = items.filter((item) => {
    if (activeFilter === 'todos')       return true;
    if (activeFilter === 'vencidos')    return item.estado === 'vencido';
    if (activeFilter === 'por_vencer')  return item.estado === 'por_vencer';
    if (activeFilter === 'buen_estado') return item.estado === 'fresco';
    return true;
  });

  const FILTERS: { key: typeof activeFilter; label: string }[] = [
    { key: 'todos',       label: 'Todos' },
    { key: 'buen_estado', label: 'Buen estado' },
    { key: 'por_vencer',  label: 'Por vencer' },
    { key: 'vencidos',    label: 'Vencidos' },
  ];

  return (
  <View style={styles.container}>
    <AppHeaderConEleccionHogar
      hogares={hogares}
      selectedId={selectedHouseholdId}
      onSelect={setSelectedHouseholdId}
    />

    {/* Tabs */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      {STOCK_TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {activeTab === 'lista_compras' ? (
      <ListaDeComprasScreen
        items={shoppingList}
        stockItems={items}
        onRemove={handleRemoveFromList}
        onChangeQuantity={handleChangeQuantity}
        onAddManual={handleAddManual}
        onAddSuggestion={handleAddSuggestion}
      />
    ) : activeTab === 'recetas' ? (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>Recetas próximamente.</Text>
      </ScrollView>
    ) : (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.emptyText}>Recetas próximamente.</Text>
      </ScrollView>
    ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#A8CFEE']} tintColor="#A8CFEE" />
        }
      >
        <Text style={styles.sectionTitle}>Resumen del hogar</Text>

        <View style={styles.statsGrid}>
          <StatCard value={stats.total} label="Total de productos" iconName="cart-outline" iconColor="#5B9BD5" borderColor="#A8D0F0" bgColor="#E8F4FF" />
          <StatCard value={stats.bienEstado} label="En buen estado" iconName="checkmark-circle-outline" iconColor="#27AE60" borderColor="#80CC90" bgColor="#DFF5E3" />
          <StatCard value={stats.porVencer} label="Por vencer (≤30 días)" iconName="alarm-outline" iconColor="#E07820" borderColor="#F0C060" bgColor="#FFF3CD" />
          <StatCard value={stats.vencidos} label="Vencidos" iconName="close-circle-outline" iconColor="#C0392B" borderColor="#E07070" bgColor="#FDDEDE" />
        </View>

        <Text style={styles.sectionTitle}>Todos los productos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color="#A8CFEE" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => storageAreaId && loadInventory(storageAreaId)}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>No hay productos en esta categoría.</Text>
        ) : (
          filtered.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              cartState={cartStates[item.id] ?? 'idle'}
              onAddToCart={() => handleAddToCart(item)}
              token={user?.access_token}
              onDeleted={handleItemDeleted}
              onUpdated={handleItemUpdated}
            />
          ))
        )}

      </ScrollView>
    )}

    </View>
  );
}
// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 4, marginTop: 4 },
  listaSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: { width: '47%', borderWidth: 1.5, borderRadius: 14, padding: 14, backgroundColor: '#fff', alignItems: 'flex-start', gap: 6 },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', lineHeight: 32 },
  statLabel: { fontSize: 12, color: '#666', lineHeight: 16 },

  filtersScroll: { marginBottom: 16 },
  filtersContent: { gap: 8, paddingRight: 4 },
  filterChip: { borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#A8CFEE', borderColor: '#A8CFEE' },
  filterChipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  productCard: { backgroundColor: '#fff', borderWidth: 2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  productTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productEmoji: { fontSize: 36 },
  spaceChip: { backgroundColor: '#F0F0F0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  spaceChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  productName: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 2 },
  productBrand: { fontSize: 13, color: '#4ABCB0', marginBottom: 10, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#4ABCB0', borderRadius: 4 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  expiryLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  expiryDate: { fontSize: 15, fontWeight: '700', color: '#222' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },

  tabBar: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
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
  cartButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  listaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0ECF8', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, gap: 12 },
  listaEmoji: { fontSize: 30 },
  listaInfo: { flex: 1 },
  listaName: { fontSize: 16, fontWeight: '700', color: '#222' },
  listaBrand: { fontSize: 13, color: '#4ABCB0', fontWeight: '500', marginTop: 2 },
  listaRemoveButton: { padding: 4 },

  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0F6FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  qtyButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F4FF', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', minWidth: 20, textAlign: 'center' },

  loader: { marginTop: 40 },
  errorContainer: { alignItems: 'center', marginTop: 40, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryButton: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 15, marginTop: 30 },

  placeholderContainer: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  placeholderTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  placeholderText: { fontSize: 14, color: '#888', textAlign: 'center' },

  // Three-dot button on card
  menuDots: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },

  // Action menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 4,
  },
  menuTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 8, paddingHorizontal: 4 },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  menuOptionText: { fontSize: 16, fontWeight: '600', color: '#222' },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 2 },

  // Edit modal
  editSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 8,
  },
  editTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  editLabel: { fontSize: 12, fontWeight: '700', color: '#9AACBC', textTransform: 'uppercase', letterSpacing: 0.5 },
  editInput: {
    backgroundColor: '#F5F9FF', borderWidth: 1.5, borderColor: '#D0E8F8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1A1A1A', marginBottom: 8,
  },
  editButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  editCancel: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: '#F0F0F0',
  },
  editCancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  editSave: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: '#A8CFEE',
  },
  editSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});