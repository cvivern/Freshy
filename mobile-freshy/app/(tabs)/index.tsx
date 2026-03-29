import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
  calcEstado,
  fetchHouseholds,
  fetchInventoryItems,
  fetchStorageAreas,
  DEFAULT_STORAGE_AREA_ID,
  DEFAULT_USER_ID,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useShoppingList } from '@/contexts/ShoppingListContext';
import type { InventoryItem } from '@/services/api';
import { scheduleExpiryNotifications } from '@/services/notifications';
import { useSpaceMonitor } from '@/hooks/useSpaceMonitor';
import ProductActionsMenu from '@/components/ProductActionsMenu';

type FilterState = 'todos' | 'vence_pronto' | 'buen_estado' | 'vencidos';
type SortOption = 'vence_primero' | 'vence_ultimo' | 'nombre_az' | 'mas_reciente';
type CartButtonState = 'idle' | 'loading' | 'added' | 'error';

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

const FILTERS = [
  { key: 'todos', label: 'Todos los productos' },
  { key: 'vence_pronto', label: 'Vence pronto' },
  { key: 'buen_estado', label: 'En buen estado' },
  { key: 'vencidos', label: 'Vencidos' },
];

// ─── Fuzzy search ────────────────────────────────────────────────────────────

/** Returns true if all chars of `query` appear in `target` in order (subsequence). */
function isSubsequence(query: string, target: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (query[qi] === target[ti]) qi++;
  }
  return qi === query.length;
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * Fuzzy-matches a single token against a target string.
 * Accepts: exact substring, subsequence, or edit distance ≤ floor(token.length/3) (min 1 for len≥3).
 */
function fuzzyToken(token: string, target: string): boolean {
  if (target.includes(token)) return true;
  if (isSubsequence(token, target)) return true;
  if (token.length >= 3) {
    const threshold = Math.floor(token.length / 3);
    // Check against each word in target individually for better precision
    return target.split(/\s+/).some(word => editDistance(token, word) <= threshold);
  }
  return false;
}

/** Returns true if every token in the query fuzzy-matches somewhere in the haystack. */
function fuzzyMatch(query: string, haystack: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const h = haystack.toLowerCase();
  return tokens.every(token => fuzzyToken(token, h));
}

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
  const { user } = useAuth();
  const { shoppingList, addToList, removeFromList } = useShoppingList();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterState>('todos');
  const [activeSort, setActiveSort] = useState<SortOption>('vence_primero');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [selectedStorageAreaId, setSelectedStorageAreaId] = useState('');

  useSpaceMonitor({
    userId: user?.user_id ?? DEFAULT_USER_ID,
    enabled: true,
  });

  // Cargar hogares al montar
  useEffect(() => {
    fetchHouseholds(user?.user_id ?? '', user?.access_token).then((hhs) => {
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

  const loadItems = useCallback(async (areaId: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await fetchInventoryItems(user?.user_id ?? '', areaId, user?.access_token);
      const sorted = [...data].sort((a, b) => {
        const da = a.entry_date ?? '';
        const db = b.entry_date ?? '';
        return db.localeCompare(da); // más nuevo primero
      });
      setItems(sorted);
      scheduleExpiryNotifications(sorted).catch(() => {});
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [user?.user_id, user?.access_token]);

  const handleRefresh = useCallback(() => {
    if (selectedStorageAreaId) loadItems(selectedStorageAreaId, true);
  }, [selectedStorageAreaId, loadItems]);

  // Al cambiar storage area, cargar inventario
  useEffect(() => {
    if (!selectedStorageAreaId) return;
    loadItems(selectedStorageAreaId);
  }, [selectedStorageAreaId]);

  const filteredItems = items
    .filter(item => {
      const daysLeft = getDaysLeft(item.fecha_vencimiento);
      if (search.trim()) {
        const haystack = [item.nombre, item.marca, item.categoria].filter(Boolean).join(' ');
        if (!fuzzyMatch(search, haystack)) return false;
      }
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

  const handleDeleted = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleUpdated = useCallback((id: string, fields: Partial<InventoryItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...fields } : i));
  }, []);

  const handleAddToCart = useCallback((item: InventoryItem) => {
    if (shoppingList.some((s) => s.id === item.id)) {
      removeFromList(item.id);
    } else {
      addToList({ id: item.id, emoji: item.emoji ?? '📦', name: item.nombre, brand: item.marca ?? '' });
    }
  }, [shoppingList, addToList, removeFromList]);

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={setSelectedHouseholdId}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#A8CFEE']} tintColor="#A8CFEE" />
        }
      >

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
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#bbb" />
                </TouchableOpacity>
              )}
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
                fetchInventoryItems(user?.user_id ?? '', selectedStorageAreaId, user?.access_token)
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
            const estado = calcEstado(item.fecha_vencimiento);
            const status = estado === 'vencido'
              ? { label: 'Vencido',       bg: '#FDDEDE', textColor: '#C0392B', borderColor: '#E07070' }
              : estado === 'por_vencer'
              ? { label: 'Por vencer',    bg: '#FFF3CD', textColor: '#996600', borderColor: '#E0C050' }
              : { label: 'En buen estado', bg: '#DFF5E3', textColor: '#27AE60', borderColor: '#60B870' };
            const shelfLife = estado === 'vencido' ? 1 : estado === 'por_vencer' ? 7 : 30;
            const progress = Math.min(1, Math.max(0, (shelfLife - daysLeft) / shelfLife));
            return (
              <View key={item.id} style={[styles.foodCard, { borderColor: status.borderColor }]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.foodEmoji}>{item.emoji ?? '📦'}</Text>
                  <View style={styles.cardTopRight}>
                    {!!item.categoria && (
                      <View style={styles.spaceChip}>
                        <Text style={styles.spaceChipText}>{item.categoria}</Text>
                      </View>
                    )}
                    <CartButton state={shoppingList.some(s => s.id === item.id) ? 'added' : 'idle'} onPress={() => handleAddToCart(item)} />
                    <ProductActionsMenu
                      item={item}
                      token={user?.access_token}
                      onDeleted={handleDeleted}
                      onUpdated={handleUpdated}
                    />
                  </View>
                </View>
                <Text style={styles.foodName}>{item.nombre}</Text>
                {!!item.marca && <Text style={styles.foodBrand}>{item.marca}</Text>}
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: status.borderColor }]} />
                </View>
                <View style={styles.productFooter}>
                  <View>
                    <Text style={styles.expiryLabel}>Vencimiento</Text>
                    <Text style={styles.expiryDate}>{formatExpiryDate(item.fecha_vencimiento)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.textColor }]}>{status.label}</Text>
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
  sortChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F0F0F0' },
  sortChipActive: { backgroundColor: '#A8CFEE' },
  sortChipText: { fontSize: 12, color: '#999', fontWeight: '600' },
  sortChipTextActive: { color: '#fff', fontWeight: '700' },
  foodCard: { backgroundColor: '#fff', borderWidth: 2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  foodEmoji: { fontSize: 36 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spaceChip: { backgroundColor: '#F0F0F0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  spaceChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  cartButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 2 },
  foodBrand: { fontSize: 13, color: '#4ABCB0', marginBottom: 10, fontWeight: '500' },
  progressTrack: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  expiryLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  expiryDate: { fontSize: 15, fontWeight: '700', color: '#222' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
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
