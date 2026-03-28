import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  DEFAULT_USER_ID,
  calcEstado,
  fetchHouseholds,
  fetchInventoryItems,
  fetchStorageAreas,
} from '@/services/api';
import type { InventoryItem } from '@/services/api';

type FilterState = 'todos' | 'vence_pronto' | 'buen_estado' | 'vencidos';
type SortOption = 'vence_primero' | 'vence_ultimo' | 'nombre_az' | 'mas_reciente';

const FILTERS = [
  { key: 'todos', label: 'Todos los productos' },
  { key: 'vence_pronto', label: 'Vence pronto' },
  { key: 'buen_estado', label: 'En buen estado' },
  { key: 'vencidos', label: 'Vencidos' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysLeft(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(fechaVencimiento);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
}

function formatExpiryDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function getBorderColor(daysLeft: number) {
  if (daysLeft < 0) return '#E07070';
  if (daysLeft <= 7) return '#E0C050';
  return '#60B870';
}

function getStatusBadge(daysLeft: number): { text: string; bg: string; textColor: string } {
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return { text: `❌  Venció hace ${days} ${days === 1 ? 'día' : 'días'}`, bg: '#FDDEDE', textColor: '#C0392B' };
  }
  if (daysLeft === 0) return { text: '⚠️  Vence hoy', bg: '#FFF0CC', textColor: '#B8860B' };
  if (daysLeft === 1) return { text: '⚠️  Vence mañana', bg: '#FFF0CC', textColor: '#B8860B' };
  if (daysLeft <= 7) return { text: `⚠️  Vence en ${daysLeft} días`, bg: '#FFF0CC', textColor: '#B8860B' };
  return { text: `✅  Vence en ${daysLeft} días`, bg: '#DFF5E3', textColor: '#27AE60' };
}

// ─── Dropdown component ───────────────────────────────────────────────────────
type Option = { key: string; label: string };
type DropdownProps = { options: Option[]; selected: string; onSelect: (key: string) => void };

function Dropdown({ options, selected, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.key === selected)?.label ?? '';

  return (
    <View>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.buttonText} numberOfLines={1}>{selectedLabel}</Text>
        <Ionicons name="chevron-down" size={16} color="#555" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {options.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.menuItem, option.key === selected && styles.menuItemActive]}
                onPress={() => { onSelect(option.key); setOpen(false); }}
              >
                <Text style={[styles.menuItemText, option.key === selected && styles.menuItemTextActive]}>
                  {option.label}
                </Text>
                {option.key === selected && <Ionicons name="checkmark" size={16} color="#222" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterState>('todos');
  const [activeSort, setActiveSort] = useState<SortOption>('vence_primero');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [selectedStorageAreaId, setSelectedStorageAreaId] = useState('');

  // Cargar hogares al montar
  useEffect(() => {
    fetchHouseholds(DEFAULT_USER_ID).then((hhs) => {
      if (hhs.length > 0) {
        const opts: HogarOption[] = hhs.map(h => ({ id: h.id, name: h.name }));
        setHogares(opts);
        setSelectedHouseholdId(opts[0].id);
      }
    }).catch(() => {});
  }, []);

  // Al cambiar hogar, cargar su primer storage area
  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchStorageAreas(selectedHouseholdId).then((areas) => {
      if (areas.length > 0) {
        setSelectedStorageAreaId(areas[0].id);
      } else {
        setSelectedStorageAreaId('');
        setItems([]);
        setLoading(false);
      }
    }).catch(() => {
      setSelectedStorageAreaId('');
      setItems([]);
      setLoading(false);
    });
  }, [selectedHouseholdId]);

  // Al cambiar storage area, cargar inventario
  useEffect(() => {
    if (!selectedStorageAreaId) return;
    setLoading(true);
    setError(null);
    fetchInventoryItems(DEFAULT_USER_ID, selectedStorageAreaId)
      .then(setItems)
      .catch((e) => setError(e.message ?? 'Error al cargar'))
      .finally(() => setLoading(false));
  }, [selectedStorageAreaId]);

  const filteredItems = items
    .filter(item => {
      const daysLeft = getDaysLeft(item.fecha_vencimiento);
      if (search && !item.nombre.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeFilter === 'vence_pronto') return daysLeft >= 0 && daysLeft <= 7;
      if (activeFilter === 'buen_estado') return daysLeft > 7;
      if (activeFilter === 'vencidos') return daysLeft < 0;
      return true;
    })
    .sort((a, b) => {
      const dA = getDaysLeft(a.fecha_vencimiento);
      const dB = getDaysLeft(b.fecha_vencimiento);
      switch (activeSort) {
        case 'vence_primero': return dA - dB;
        case 'vence_ultimo': return dB - dA;
        case 'nombre_az': return a.nombre.localeCompare(b.nombre);
        case 'mas_reciente': return a.id < b.id ? 1 : -1;
        default: return 0;
      }
    });

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={setSelectedHouseholdId}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        <Text style={styles.greeting}>Hola!</Text>

        {/* Search + Filter */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar alimentos"
                placeholderTextColor="#aaa"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Dropdown options={FILTERS} selected={activeFilter} onSelect={(k) => setActiveFilter(k as FilterState)} />
          </View>
        </View>

        {/* Sort */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {([
            { key: 'vence_primero', label: 'Vence pronto' },
            { key: 'vence_ultimo', label: 'Vence último' },
            { key: 'nombre_az', label: 'A–Z' },
          ] as { key: SortOption; label: string }[]).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, activeSort === opt.key && styles.sortChipActive]}
              onPress={() => setActiveSort(opt.key)}
            >
              <Text style={[styles.sortChipText, activeSort === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator size="large" color="#A8CFEE" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                if (!selectedStorageAreaId) return;
                setLoading(true);
                setError(null);
                fetchInventoryItems(DEFAULT_USER_ID, selectedStorageAreaId)
                  .then(setItems)
                  .catch((e) => setError(e.message ?? 'Error al cargar'))
                  .finally(() => setLoading(false));
              }}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>
            {search || activeFilter !== 'todos' ? 'Sin resultados para este filtro.' : 'No hay productos en este hogar todavía.'}
          </Text>
        ) : (
          filteredItems.map((item) => {
            const daysLeft = getDaysLeft(item.fecha_vencimiento);
            const badge = getStatusBadge(daysLeft);
            const estado = calcEstado(item.fecha_vencimiento);
            const estadoLabel = estado === 'fresco' ? 'Fresco' : estado === 'por_vencer' ? 'Por vencer' : 'Vencido';
            return (
              <View key={item.id} style={[styles.foodCard, { borderColor: getBorderColor(daysLeft) }]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.foodEmoji}>{item.emoji ?? '📦'}</Text>
                  <Text style={[styles.foodName, { flex: 1 }]}>{item.nombre}</Text>
                </View>

                <Text style={styles.foodCategory}>
                  {item.categoria ?? ''}{item.marca ? ` - ${item.marca}` : ''}
                </Text>

                <View style={styles.expiryRow}>
                  <Text style={styles.expiryLabel}>Vencimiento</Text>
                  <Text style={styles.expiryDate}>{formatExpiryDate(item.fecha_vencimiento)}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.foodState}>📝 {estadoLabel}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.text}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 26, fontWeight: '600', color: '#222', marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#222', paddingVertical: 0 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#FAFAFA' },
  sortChipActive: { borderColor: '#A8CFEE', backgroundColor: '#E8F4FF' },
  sortChipText: { fontSize: 12, color: '#888' },
  sortChipTextActive: { color: '#2C7BB5', fontWeight: '700' },
  foodCard: { backgroundColor: '#fff', borderWidth: 2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 10 },
  foodEmoji: { fontSize: 18 },
  foodName: { fontSize: 16, fontWeight: '700', color: '#222', marginTop: 2 },
  foodCategory: { fontSize: 14, color: '#A8CFEE', marginBottom: 8, marginLeft: 35 },
  expiryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expiryLabel: { fontSize: 14, color: '#A8CFEE', paddingLeft: 5 },
  expiryDate: { fontSize: 14, fontWeight: '700', color: '#222' },
  foodState: { fontSize: 14, color: '#555', marginBottom: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { fontSize: 14, fontWeight: '600' },
  errorBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyText: { color: '#AAA', textAlign: 'center', marginTop: 40, fontSize: 14 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  buttonText: { flex: 1, fontSize: 13, color: '#222' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 32, borderRadius: 20 },
  menu: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  menuItemActive: { backgroundColor: '#F5F5F5' },
  menuItemText: { flex: 1, fontSize: 15, color: '#444' },
  menuItemTextActive: { fontWeight: '600', color: '#222' },
});
