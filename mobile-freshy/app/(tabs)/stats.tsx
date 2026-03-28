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
import AppHeader from '@/components/AppHeader';
import {
  DEFAULT_STORAGE_AREA_ID,
  DEFAULT_USER_ID,
  fetchInventoryItems,
  type InventoryItem,
} from '@/services/api';

// ------- Types -------
type StatsData = {
  total: number;
  fresco: number;
  por_vencer: number;
  vencido: number;
  top_productos: { emoji: string; name: string; brand: string; cantidad: number }[];
  categorias: { nombre: string; cantidad: number }[];
};

// ------- Sub-components -------
function SummaryCard({
  value,
  label,
  iconName,
  iconColor,
  bgColor,
}: {
  value: string | number;
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  bgColor: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StateBar({ fresco, porVencer, vencido }: { fresco: number; porVencer: number; vencido: number }) {
  const total = fresco + porVencer + vencido || 1;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Estado actual del inventario</Text>
      <View style={styles.stateBar}>
        {fresco > 0 && <View style={[styles.stateSegment, { width: `${(fresco / total) * 100}%` as any, backgroundColor: '#60B870' }]} />}
        {porVencer > 0 && <View style={[styles.stateSegment, { width: `${(porVencer / total) * 100}%` as any, backgroundColor: '#E0C050' }]} />}
        {vencido > 0 && <View style={[styles.stateSegment, { width: `${(vencido / total) * 100}%` as any, backgroundColor: '#E07070' }]} />}
      </View>
      <View style={styles.stateLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#60B870' }]} />
          <Text style={styles.legendText}>Frescos ({fresco})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E0C050' }]} />
          <Text style={styles.legendText}>Por vencer ({porVencer})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#E07070' }]} />
          <Text style={styles.legendText}>Vencidos ({vencido})</Text>
        </View>
      </View>
    </View>
  );
}

function TopProductos({ items }: { items: StatsData['top_productos'] }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.cantidad), 1);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📦 Más en inventario</Text>
      {items.map((item, idx) => (
        <View key={item.name} style={styles.rankRow}>
          <Text style={styles.rankNum}>{idx + 1}</Text>
          <Text style={styles.rankEmoji}>{item.emoji}</Text>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>{item.name}</Text>
            <Text style={styles.rankBrand}>{item.brand}</Text>
            <View style={styles.rankTrack}>
              <View style={[styles.topFill, { width: `${(item.cantidad / max) * 100}%` as any }]} />
            </View>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.topCount}>{item.cantidad}</Text>
            <Text style={styles.rankSubCount}>{item.cantidad === 1 ? 'unidad' : 'unidades'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Categorias({ items }: { items: StatsData['categorias'] }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.cantidad), 1);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🗂️ Por categoría</Text>
      {items.map((item) => (
        <View key={item.nombre} style={styles.catRow}>
          <Text style={styles.catNombre}>{item.nombre}</Text>
          <View style={styles.catBarWrap}>
            <View style={[styles.catBar, { width: `${(item.cantidad / max) * 100}%` as any }]} />
          </View>
          <Text style={styles.catCount}>{item.cantidad}</Text>
        </View>
      ))}
    </View>
  );
}

// ------- Main Screen -------
export default function StatsScreen() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchInventoryItems(DEFAULT_USER_ID, DEFAULT_STORAGE_AREA_ID);
      setData(computeStats(items));
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }

  function computeStats(items: InventoryItem[]): StatsData {
    const fresco = items.filter((i) => i.estado === 'fresco').length;
    const por_vencer = items.filter((i) => i.estado === 'por_vencer').length;
    const vencido = items.filter((i) => i.estado === 'vencido').length;

    const counts: Record<string, { cantidad: number; emoji: string; brand: string }> = {};
    const catCounts: Record<string, number> = {};
    for (const item of items) {
      if (!counts[item.nombre]) counts[item.nombre] = { cantidad: 0, emoji: item.emoji ?? '📦', brand: item.marca ?? '' };
      counts[item.nombre].cantidad++;
      const cat = item.categoria ?? 'Sin categoría';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    const top_productos = Object.entries(counts)
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 5)
      .map(([name, v]) => ({ emoji: v.emoji, name, brand: v.brand, cantidad: v.cantidad }));

    const categorias = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    return { total: items.length, fresco, por_vencer, vencido, top_productos, categorias };
  }

  useEffect(() => { loadStats(); }, []);

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#A8CFEE" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadStats}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryCard value={data.total} label="Total de productos" iconName="cart-outline" iconColor="#5B9BD5" bgColor="#E8F4FF" />
              <SummaryCard value={data.fresco} label="En buen estado" iconName="checkmark-circle-outline" iconColor="#27AE60" bgColor="#DFF5E3" />
              <SummaryCard value={data.por_vencer} label="Por vencer" iconName="alarm-outline" iconColor="#E07820" bgColor="#FFF3CD" />
              <SummaryCard value={data.vencido} label="Vencidos" iconName="close-circle-outline" iconColor="#C0392B" bgColor="#FDDEDE" />
            </View>

            <StateBar fresco={data.fresco} porVencer={data.por_vencer} vencido={data.vencido} />
            <TopProductos items={data.top_productos} />
            <Categorias items={data.categorias} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  loader: { marginTop: 60 },
  errorBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  summaryCard: {
    width: '47%',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
    gap: 4,
  },
  summaryIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', lineHeight: 32 },
  summaryLabel: { fontSize: 12, color: '#666' },

  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 14 },

  stateBar: { flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 12 },
  stateSegment: { height: '100%' },
  stateLegend: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: '#555' },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  rankNum: { fontSize: 13, fontWeight: '700', color: '#BBB', width: 16, textAlign: 'center' },
  rankEmoji: { fontSize: 26 },
  rankInfo: { flex: 1, gap: 2 },
  rankName: { fontSize: 14, fontWeight: '700', color: '#222' },
  rankBrand: { fontSize: 12, color: '#4ABCB0', marginBottom: 4 },
  rankTrack: { height: 7, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden' },
  rankBadge: { alignItems: 'center', minWidth: 52 },
  rankSubCount: { fontSize: 10, color: '#999' },
  topFill: { height: 7, backgroundColor: '#A8CFEE', borderRadius: 4 },
  topCount: { fontSize: 20, fontWeight: '800', color: '#2C7BB5', lineHeight: 24 },

  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catNombre: { fontSize: 13, color: '#444', width: 110 },
  catBarWrap: { flex: 1, height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden' },
  catBar: { height: 10, backgroundColor: '#A8CFEE', borderRadius: 5 },
  catCount: { fontSize: 13, fontWeight: '700', color: '#555', width: 28, textAlign: 'right' },
});
