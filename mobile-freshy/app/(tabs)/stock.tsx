import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';
import type { HogarOption } from '@/components/AppHeaderConEleccionHogar';
import { fetchInventory, fetchHouseholds, fetchStorageAreas, DEFAULT_USER_ID, calcEstado } from '@/services/api';
import type { InventoryItemResponse } from '@/services/api';

// ------- Types -------
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

type ShoppingItem = {
  id: string;
  emoji: string;
  name: string;
  quantity: number;
  suggested: boolean;
};

type ActiveView = 'stock' | 'compras';

const VIEWS: { key: ActiveView; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'compras', label: 'Lista de compras' },
];

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

function getStatus(estado: StockItem['estado']) {
  if (estado === 'vencido')    return { label: 'Vencido',       bg: '#FDDEDE', textColor: '#C0392B', borderColor: '#E07070' };
  if (estado === 'por_vencer') return { label: 'Por vencer',    bg: '#FFF3CD', textColor: '#996600', borderColor: '#E0C050' };
  return                              { label: 'En buen estado', bg: '#DFF5E3', textColor: '#27AE60', borderColor: '#60B870' };
}

function calcStats(items: StockItem[]) {
  return {
    total:      items.length,
    vencidos:   items.filter(i => i.estado === 'vencido').length,
    porVencer:  items.filter(i => i.estado === 'por_vencer').length,
    bienEstado: items.filter(i => i.estado === 'fresco').length,
  };
}

// ------- Sub-components -------
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

function ProductCard({ item }: { item: StockItem }) {
  const status = getStatus(item.estado);
  const progress = Math.min(1, Math.max(0, (item.shelfLife - item.daysLeft) / item.shelfLife));
  return (
    <View style={[styles.productCard, { borderColor: status.borderColor }]}>
      <View style={styles.productTopRow}>
        <Text style={styles.productEmoji}>{item.emoji}</Text>
        <View style={styles.spaceChip}>
          <Text style={styles.spaceChipText}>{item.space}</Text>
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

function ShoppingRow({ item, onChangeQty, onRemove, suggested = false }: {
  item: ShoppingItem;
  onChangeQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  suggested?: boolean;
}) {
  return (
    <View style={[styles.shoppingRow, suggested && styles.shoppingRowSuggested]}>
      <Text style={styles.shoppingEmoji}>{item.emoji}</Text>
      <Text style={styles.shoppingName} numberOfLines={1}>{item.name}</Text>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onChangeQty(item.id, -1)}>
          <Ionicons name="remove" size={16} color="#555" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onChangeQty(item.id, 1)}>
          <Ionicons name="add" size={16} color="#555" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#ccc" />
      </TouchableOpacity>
    </View>
  );
}

// ------- View selector -------
function ViewSelector({ active, onChange }: { active: ActiveView; onChange: (v: ActiveView) => void }) {
  const currentIndex = VIEWS.findIndex(v => v.key === active);

  const cycleLeft = () => {
    const i = (currentIndex - 1 + VIEWS.length) % VIEWS.length;
    onChange(VIEWS[i].key);
  };
  const cycleRight = () => {
    const i = (currentIndex + 1) % VIEWS.length;
    onChange(VIEWS[i].key);
  };

  return (
    <View style={styles.viewSelector}>
      <TouchableOpacity onPress={cycleLeft} style={styles.viewArrow}>
        <Ionicons name="chevron-back" size={20} color="#4A90D9" />
      </TouchableOpacity>
      <Text style={styles.viewLabel}>{VIEWS[currentIndex].label}</Text>
      <TouchableOpacity onPress={cycleRight} style={styles.viewArrow}>
        <Ionicons name="chevron-forward" size={20} color="#4A90D9" />
      </TouchableOpacity>
    </View>
  );
}

// ------- Main Screen -------
export default function StockScreen() {
  const [activeView, setActiveView] = useState<ActiveView>('stock');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'buen_estado' | 'por_vencer' | 'vencidos'>('todos');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [storageAreaId, setStorageAreaId] = useState('');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');

  async function loadInventory(areaId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory(DEFAULT_USER_ID, areaId);
      const mapped = data.map(mapToStockItem);
      setStockItems(mapped);
      // Suggestions automatiques : produits vencidos
      const suggestions: ShoppingItem[] = mapped
        .filter(i => i.estado === 'vencido')
        .map(i => ({
          id: `suggested-${i.id}`,
          emoji: i.emoji,
          name: i.name,
          quantity: 1,
          suggested: true,
        }));
      setShoppingItems(prev => {
        const manual = prev.filter(i => !i.suggested);
        return [...manual, ...suggestions];
      });
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHouseholds(DEFAULT_USER_ID).then((hhs) => {
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
        setStockItems([]);
        setLoading(false);
      }
    }).catch(() => {
      setStorageAreaId('');
      setStockItems([]);
      setLoading(false);
    });
  }, [selectedHouseholdId]);

  useEffect(() => {
    if (!storageAreaId) return;
    loadInventory(storageAreaId);
  }, [storageAreaId]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  function addFromStock(stockItem: StockItem) {
    const existingId = `stock-${stockItem.id}`;
    setShoppingItems(prev => {
      const exists = prev.find(i => i.id === existingId);
      if (exists) {
        return prev.map(i => i.id === existingId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: existingId,
        emoji: stockItem.emoji,
        name: stockItem.name,
        quantity: 1,
        suggested: false,
      }];
    });
    setAddModalOpen(false);
    setStockSearch('');
  }

  function changeQty(id: string, delta: number) {
    setShoppingItems(prev =>
      prev.map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
          .filter(i => i.quantity > 0)
    );
  }

  function removeShoppingItem(id: string) {
    setShoppingItems(prev => prev.filter(i => i.id !== id));
  }

  const stats = calcStats(stockItems);
  const filtered = stockItems.filter(item => {
    if (activeFilter === 'todos')       return true;
    if (activeFilter === 'vencidos')    return item.estado === 'vencido';
    if (activeFilter === 'por_vencer')  return item.estado === 'por_vencer';
    if (activeFilter === 'buen_estado') return item.estado === 'fresco';
    return true;
  });

  const FILTERS: { key: typeof activeFilter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'buen_estado', label: 'Buen estado' },
    { key: 'por_vencer', label: 'Por vencer' },
    { key: 'vencidos', label: 'Vencidos' },
  ];

  const manualItems = shoppingItems.filter(i => !i.suggested);
  const suggestedItems = shoppingItems.filter(i => i.suggested);

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={setSelectedHouseholdId}
      />

      {/* Sélecteur de vue avec flèches */}
      <ViewSelector active={activeView} onChange={setActiveView} />

      {/* ─── VUE STOCK ─── */}
      {activeView === 'stock' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Resumen del hogar</Text>
          <View style={styles.statsGrid}>
            <StatCard value={stats.total}      label="Total de productos"   iconName="cart-outline"           iconColor="#5B9BD5" borderColor="#A8D0F0" bgColor="#E8F4FF" />
            <StatCard value={stats.bienEstado} label="En buen estado"       iconName="checkmark-circle-outline" iconColor="#27AE60" borderColor="#80CC90" bgColor="#DFF5E3" />
            <StatCard value={stats.porVencer}  label="Por vencer (≤30 días)" iconName="alarm-outline"          iconColor="#E07820" borderColor="#F0C060" bgColor="#FFF3CD" />
            <StatCard value={stats.vencidos}   label="Vencidos"             iconName="close-circle-outline"   iconColor="#C0392B" borderColor="#E07070" bgColor="#FDDEDE" />
          </View>

          <Text style={styles.sectionTitle}>Todos los productos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
            {FILTERS.map(f => (
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
            filtered.map(item => <ProductCard key={item.id} item={item} />)
          )}
        </ScrollView>
      )}

      {/* ─── VUE LISTE DE COMPRAS ─── */}
      {activeView === 'compras' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

          {/* Bouton + */}
          <TouchableOpacity style={styles.addFromStockBtn} onPress={() => setAddModalOpen(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addFromStockText}>Agregar del stock</Text>
          </TouchableOpacity>

          {/* Modal de sélection depuis le stock */}
          <Modal visible={addModalOpen} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Agregar del stock</Text>
                  <TouchableOpacity onPress={() => { setAddModalOpen(false); setStockSearch(''); }}>
                    <Ionicons name="close" size={22} color="#555" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearch}>
                  <Ionicons name="search-outline" size={16} color="#aaa" />
                  <TextInput
                    style={styles.modalSearchInput}
                    value={stockSearch}
                    onChangeText={setStockSearch}
                    placeholder="Buscar en el stock..."
                    placeholderTextColor="#aaa"
                    autoFocus
                  />
                </View>

                <ScrollView>
                  {stockItems
                    .filter(i => !stockSearch || i.name.toLowerCase().includes(stockSearch.toLowerCase()))
                    .map(item => {
                      const status = getStatus(item.estado);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.modalItem}
                          onPress={() => addFromStock(item)}
                        >
                          <Text style={styles.modalItemEmoji}>{item.emoji}</Text>
                          <View style={styles.modalItemInfo}>
                            <Text style={styles.modalItemName}>{item.name}</Text>
                            {!!item.brand && <Text style={styles.modalItemBrand}>{item.brand}</Text>}
                          </View>
                          <View style={[styles.modalItemBadge, { backgroundColor: status.bg }]}>
                            <Text style={[styles.modalItemBadgeText, { color: status.textColor }]}>
                              {status.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Liste manuelle */}
          {manualItems.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Lista de compras</Text>
              {manualItems.map(item => (
                <ShoppingRow key={item.id} item={item} onChangeQty={changeQty} onRemove={removeShoppingItem} />
              ))}
            </>
          )}

          {suggestedItems.length > 0 && (
            <>
              <View style={styles.suggestionHeader}>
                <Ionicons name="sparkles-outline" size={16} color="#E07820" />
                <Text style={styles.suggestionTitle}>Sugerencias — productos vencidos</Text>
              </View>
              <Text style={styles.suggestionSubtitle}>
                Estos productos vencieron en tu stock. ¿Los agregás a la lista?
              </Text>
              {suggestedItems.map(item => (
                <ShoppingRow key={item.id} item={item} onChangeQty={changeQty} onRemove={removeShoppingItem} suggested />
              ))}
            </>
          )}

          {shoppingItems.length === 0 && (
            <Text style={styles.emptyText}>Tu lista está vacía. ¡Agregá productos!</Text>
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

  viewSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  viewArrow: { padding: 4 },
  viewLabel: { fontSize: 16, fontWeight: '700', color: '#222', minWidth: 140, textAlign: 'center' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 14, marginTop: 4 },

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

  addRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  addInput: { flex: 1, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#222', backgroundColor: '#fff' },
  addBtn: { backgroundColor: '#A8CFEE', borderRadius: 10, width: 44, alignItems: 'center', justifyContent: 'center' },

  shoppingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, backgroundColor: '#fff' },
  shoppingRowSuggested: { borderColor: '#F0C060', backgroundColor: '#FFFBF0' },
  shoppingEmoji: { fontSize: 24 },
  shoppingName: { flex: 1, fontSize: 15, color: '#222', fontWeight: '500' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  qtyBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 15, fontWeight: '700', color: '#222', minWidth: 20, textAlign: 'center' },
  deleteBtn: { padding: 4 },

  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, marginBottom: 4 },
  suggestionTitle: { fontSize: 15, fontWeight: '700', color: '#E07820' },
  suggestionSubtitle: { fontSize: 13, color: '#888', marginBottom: 12 },

  loader: { marginTop: 40 },
  errorContainer: { alignItems: 'center', marginTop: 40, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryButton: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 15, marginTop: 30 },
  addFromStockBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: '#A8CFEE',
  borderRadius: 12,
  paddingVertical: 12,
  marginBottom: 24,
},
addFromStockText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '700',
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},
modalSheet: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  maxHeight: '80%',
  paddingBottom: 30,
},
modalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 20,
  borderBottomWidth: 0.5,
  borderBottomColor: '#eee',
},
modalTitle: {
  fontSize: 17,
  fontWeight: '700',
  color: '#222',
},
modalSearch: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  margin: 14,
  borderWidth: 1.5,
  borderColor: '#ccc',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 8,
},
modalSearchInput: {
  flex: 1,
  fontSize: 14,
  color: '#222',
  paddingVertical: 0,
},
modalItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderBottomWidth: 0.5,
  borderBottomColor: '#f0f0f0',
},
modalItemEmoji: { fontSize: 28 },
modalItemInfo: { flex: 1 },
modalItemName: { fontSize: 15, fontWeight: '600', color: '#222' },
modalItemBrand: { fontSize: 12, color: '#888', marginTop: 2 },
modalItemBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
modalItemBadgeText: { fontSize: 11, fontWeight: '700' },
});