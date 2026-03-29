import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';
import type { HogarOption } from '@/components/AppHeaderConEleccionHogar';
import { fetchInventory, fetchHouseholds, fetchStorageAreas, calcEstado } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { InventoryItemResponse } from '@/services/api';

// ------- Types -------
type StockItem = {
  id: string;
  emoji: string;
  name: string;
  brand: string;
  space: string;
  expiryDate: string;  // 'DD/MM/YYYY'
  daysLeft: number;    // negative = expired — kept for progress bar
  shelfLife: number;
  estado: 'fresco' | 'por_vencer' | 'vencido';
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
  const daysLeft = item.fecha_vencimiento != null
    ? calcDaysLeft(item.fecha_vencimiento)
    : 999;
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
  label: string;
  bg: string;
  textColor: string;
  borderColor: string;
} {
  if (estado === 'vencido')    return { label: 'Vencido',        bg: '#FDDEDE', textColor: '#C0392B', borderColor: '#E07070' };
  if (estado === 'por_vencer') return { label: 'Por vencer',     bg: '#FFF3CD', textColor: '#996600', borderColor: '#E0C050' };
  return                              { label: 'En buen estado',  bg: '#DFF5E3', textColor: '#27AE60', borderColor: '#60B870' };
}

function calcStats(items: StockItem[]) {
  return {
    total:      items.length,
    vencidos:   items.filter((i) => i.estado === 'vencido').length,
    porVencer:  items.filter((i) => i.estado === 'por_vencer').length,
    bienEstado: items.filter((i) => i.estado === 'fresco').length,
  };
}

// ------- Sub-components -------
function StatCard({
  value, label, iconName, iconColor, borderColor, bgColor,
}: {
  value: number;
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  borderColor: string;
  bgColor: string;
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

// ------- Main Screen -------
type StockTab = 'stock' | 'lista_compras';

const STOCK_TABS: { key: StockTab; label: string }[] = [
  { key: 'stock', label: 'Stock' },
  { key: 'lista_compras', label: 'Lista de compras' },
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

  async function loadInventory(areaId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory(user?.user_id ?? '', areaId, user?.access_token);
      setItems(data.map(mapToStockItem));
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }

  // Load households on mount
  useEffect(() => {
    fetchHouseholds(user?.user_id ?? '', user?.access_token).then((hhs) => {
      if (hhs.length > 0) {
        const opts: HogarOption[] = hhs.map(h => ({ id: h.id, name: h.name }));
        setHogares(opts);
        setSelectedHouseholdId(opts[0].id);
      }
    }).catch(() => {});
  }, []);

  // When household changes, load its first storage area
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

  // When storage area changes, load inventory
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
    { key: 'todos', label: 'Todos' },
    { key: 'buen_estado', label: 'Buen estado' },
    { key: 'por_vencer', label: 'Por vencer' },
    { key: 'vencidos', label: 'Vencidos' },
  ];

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={setSelectedHouseholdId}
      />

      {/* ---- 2-tab bar: Stock / Lista de compras ---- */}
      <View style={styles.tabBar}>
        {STOCK_TABS.map((tab) => (
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
        {activeTab === 'lista_compras' ? (
          <Text style={styles.emptyText}>Lista de compras próximamente.</Text>
        ) : (
        <>
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
          filtered.map((item) => <ProductCard key={item.id} item={item} />)
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 14, marginTop: 4 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
    gap: 6,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', lineHeight: 32 },
  statLabel: { fontSize: 12, color: '#666', lineHeight: 16 },

  filtersScroll: { marginBottom: 16 },
  filtersContent: { gap: 8, paddingRight: 4 },
  filterChip: { borderWidth: 1.5, borderColor: '#CCC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#A8CFEE', borderColor: '#A8CFEE' },
  filterChipText: { fontSize: 14, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  productCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
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

  loader: { marginTop: 40 },
  errorContainer: { alignItems: 'center', marginTop: 40, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryButton: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 15, marginTop: 30 },
});
