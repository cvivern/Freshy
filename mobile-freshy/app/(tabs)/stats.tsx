import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';
import type { HogarOption } from '@/components/AppHeaderConEleccionHogar';
import {
  CLIMATE_EMOJI,
  fetchHouseholds,
  fetchInventoryItems,
  fetchStorageAreas,
  calcEstado,
  type InventoryItem,
  type StorageArea,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

// ------- Types -------
type StatsData = {
  total: number;
  fresco: number;
  por_vencer: number;
  vencido: number;
  salud_score: number;
  proximos_vencer: { nombre: string; emoji: string; daysLeft: number }[];
  categorias_riesgo: { nombre: string; en_riesgo: number; total: number }[];
  top_productos: { emoji: string; name: string; brand: string; cantidad: number }[];
  categorias: { nombre: string; cantidad: number }[];
  vencidos_list: { emoji: string; name: string; brand: string; cantidad: number }[];
};

// ------- Sub-components -------

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
      <Text style={styles.sectionTitle}>📦 Top 5 productos más frecuentes en inventario</Text>
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

function VencidosList({ items }: { items: StatsData['vencidos_list'] }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.cantidad), 1);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🗑️ Top productos que más se vencen</Text>
      {items.map((item, idx) => (
        <View key={item.name} style={styles.rankRow}>
          <Text style={styles.rankNum}>{idx + 1}</Text>
          <Text style={styles.rankEmoji}>{item.emoji}</Text>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>{item.name}</Text>
            <Text style={styles.rankBrand}>{item.brand || '—'}</Text>
            <View style={styles.rankTrack}>
              <View style={[styles.vencidoFill, { width: `${(item.cantidad / max) * 100}%` as any }]} />
            </View>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.vencidoCount}>{item.cantidad}</Text>
            <Text style={styles.rankSubCount}>{item.cantidad === 1 ? 'vez' : 'veces'}</Text>
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
      <Text style={styles.sectionTitle}>🗂️ Top frecuencia de productos por categoría</Text>
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

function SaludScore({ score, total }: { score: number; total: number }) {
  if (total === 0) return null;
  const grade =
    score >= 80 ? { emoji: '🌟', label: 'Excelente', color: '#27AE60', bg: '#DFF5E3' } :
    score >= 60 ? { emoji: '✅', label: 'Bien',       color: '#4A90D9', bg: '#E8F4FF' } :
    score >= 40 ? { emoji: '⚠️', label: 'Regular',   color: '#E0A020', bg: '#FFF8E0' } :
    score >= 20 ? { emoji: '😰', label: 'Mal',        color: '#E07820', bg: '#FFF0E0' } :
                  { emoji: '💀', label: 'Crítico',    color: '#C0392B', bg: '#FDDEDE' };
  const desc =
    score >= 60 ? '¡Tu inventario está en buen estado!' :
    score >= 40 ? 'Hay productos en riesgo. Revisá los por vencer.' :
                  'Alerta: muchos productos están vencidos o en riesgo.';
  return (
    <View style={[styles.section, styles.saludCard]}>
      <View style={[styles.saludRing, { borderColor: grade.color }]}>
        <Text style={[styles.saludScoreNum, { color: grade.color }]}>{score}</Text>
        <Text style={[styles.saludPct, { color: grade.color }]}>%</Text>
      </View>
      <View style={styles.saludInfo}>
        <Text style={styles.saludTitle}>Salud del hogar</Text>
        <View style={[styles.saludBadge, { backgroundColor: grade.bg }]}>
          <Text style={[styles.saludGrade, { color: grade.color }]}>{grade.emoji} {grade.label}</Text>
        </View>
        <Text style={styles.saludDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function ProximosVencimientos({ items }: { items: StatsData['proximos_vencer'] }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⏰ Próximos vencimientos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.proximosList}>
        {items.map((item, idx) => {
          const color = item.daysLeft === 0 ? '#C0392B' : item.daysLeft <= 2 ? '#E07820' : '#E0A020';
          const bg    = item.daysLeft === 0 ? '#FDDEDE' : item.daysLeft <= 2 ? '#FFF0E0' : '#FFF8E0';
          const label = item.daysLeft === 0 ? 'hoy' : item.daysLeft === 1 ? 'mañana' : `${item.daysLeft} días`;
          return (
            <View key={idx} style={styles.proximoCard}>
              <Text style={styles.proximoEmoji}>{item.emoji}</Text>
              <Text style={styles.proximoName} numberOfLines={2}>{item.nombre}</Text>
              <View style={[styles.proximoPill, { backgroundColor: bg }]}>
                <Text style={[styles.proximoLabel, { color }]}>{label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CategoriasRiesgo({ items }: { items: StatsData['categorias_riesgo'] }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔥 Categorías en riesgo</Text>
      {items.map((item) => {
        const pct   = Math.round((item.en_riesgo / item.total) * 100);
        const color = pct >= 60 ? '#C0392B' : pct >= 30 ? '#E07820' : '#E0A020';
        return (
          <View key={item.nombre} style={styles.riesgoRow}>
            <View style={styles.riesgoHeader}>
              <Text style={styles.riesgoNombre}>{item.nombre}</Text>
              <Text style={[styles.riesgoPct, { color }]}>{pct}%</Text>
            </View>
            <View style={styles.riesgoTrack}>
              <View style={[styles.riesgoFill, { width: `${pct}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={styles.riesgoSub}>{item.en_riesgo} de {item.total} vence en ≤3 días</Text>
          </View>
        );
      })}
    </View>
  );
}

// ------- Main Screen -------
export default function StatsScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const areasRef = React.useRef<StorageArea[]>([]);
  const [hogares, setHogares] = useState<HogarOption[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');

  async function loadStats(areas: StorageArea[], areaId: string | null) {
    setLoading(true);
    setError(null);
    try {
      let items: InventoryItem[];
      if (areaId === null) {
        if (areas.length > 0) {
          const results = await Promise.all(areas.map((a) => fetchInventoryItems(user?.user_id ?? '', a.id, user?.access_token)));
          items = results.flat();
        } else {
          items = await fetchInventoryItems(user?.user_id ?? '', undefined, user?.access_token);
        }
      } else {
        items = await fetchInventoryItems(user?.user_id ?? '', areaId, user?.access_token);
      }
      setData(computeStats(items));
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }

  async function loadAreas(householdId?: string) {
    try {
      const hhs = await fetchHouseholds(user?.user_id ?? '', user?.access_token);
      const hhId = householdId ?? hhs[0]?.id ?? '';
      setHogares(hhs.map(h => ({ id: h.id, name: h.name })));
      setSelectedHouseholdId(hhId);
      const areas = await fetchStorageAreas(hhId);
      areasRef.current = areas;
      setStorageAreas(areas);
      setSelectedAreaId(null);
      loadStats(areas, null);
    } catch {
      loadStats([], null);
    }
  }

  function onSelectHogar(id: string) {
    setSelectedHouseholdId(id);
    loadAreas(id);
  }

  function selectArea(id: string | null) {
    setSelectedAreaId(id);
    loadStats(areasRef.current, id);
  }

  function computeStats(items: InventoryItem[]): StatsData {
    const fresco = items.filter((i) => calcEstado(i.fecha_vencimiento) === 'fresco').length;
    const por_vencer = items.filter((i) => calcEstado(i.fecha_vencimiento) === 'por_vencer').length;
    const vencido = items.filter((i) => calcEstado(i.fecha_vencimiento) === 'vencido').length;

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

    const vencidoCounts: Record<string, { cantidad: number; emoji: string; brand: string }> = {};
    for (const item of items) {
      if (calcEstado(item.fecha_vencimiento) !== 'vencido') continue;
      if (!vencidoCounts[item.nombre]) vencidoCounts[item.nombre] = { cantidad: 0, emoji: item.emoji ?? '📦', brand: item.marca ?? '' };
      vencidoCounts[item.nombre].cantidad++;
    }
    const vencidos_list = Object.entries(vencidoCounts)
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 5)
      .map(([name, v]) => ({ emoji: v.emoji, name, brand: v.brand, cantidad: v.cantidad }));

    const total = items.length;
    const salud_score = total > 0 ? Math.round((fresco / total) * 100) : 0;

    const proximos_vencer = items
      .map((i) => {
        if (!i.fecha_vencimiento) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const exp = new Date(i.fecha_vencimiento); exp.setHours(0, 0, 0, 0);
        const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
        return daysLeft >= 0 && daysLeft <= 7 ? { nombre: i.nombre, emoji: i.emoji ?? '📦', daysLeft } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.daysLeft - b!.daysLeft)
      .slice(0, 10) as StatsData['proximos_vencer'];

    const catRiesgo: Record<string, { en_riesgo: number; total: number }> = {};
    for (const item of items) {
      const cat = item.categoria ?? 'Sin categoría';
      if (!catRiesgo[cat]) catRiesgo[cat] = { en_riesgo: 0, total: 0 };
      catRiesgo[cat].total++;
      if (item.fecha_vencimiento) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const exp = new Date(item.fecha_vencimiento); exp.setHours(0, 0, 0, 0);
        const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
        if (daysLeft >= 0 && daysLeft <= 3) catRiesgo[cat].en_riesgo++;
      }
    }
    const categorias_riesgo = Object.entries(catRiesgo)
      .filter(([, v]) => v.en_riesgo > 0)
      .sort((a, b) => (b[1].en_riesgo / b[1].total) - (a[1].en_riesgo / a[1].total))
      .map(([nombre, v]) => ({ nombre, en_riesgo: v.en_riesgo, total: v.total }));

    return { total, fresco, por_vencer, vencido, salud_score, proximos_vencer, categorias_riesgo, top_productos, categorias, vencidos_list };
  }

  useEffect(() => { loadAreas(); }, []);

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar
        hogares={hogares}
        selectedId={selectedHouseholdId}
        onSelect={onSelectHogar}
      />

      {/* ---- Tab bar: Todos + one per space ---- */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        <TouchableOpacity
          style={[styles.tabItem, selectedAreaId === null && styles.tabItemActive]}
          onPress={() => selectArea(null)}
        >
          <Text style={[styles.tabLabel, selectedAreaId === null && styles.tabLabelActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        {storageAreas.map((area) => (
          <TouchableOpacity
            key={area.id}
            style={[styles.tabItem, selectedAreaId === area.id && styles.tabItemActive]}
            onPress={() => selectArea(area.id)}
          >
            <Text style={[styles.tabLabel, selectedAreaId === area.id && styles.tabLabelActive]}>
              {area.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Análisis de productos</Text>
        <Text style={styles.pageSubtitle}>En diferentes espacios dentro de un hogar y en todos</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#A8CFEE" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadStats(areasRef.current, selectedAreaId)}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            <SaludScore score={data.salud_score} total={data.total} />
            <StateBar fresco={data.fresco} porVencer={data.por_vencer} vencido={data.vencido} />
            <ProximosVencimientos items={data.proximos_vencer} />
            <CategoriasRiesgo items={data.categorias_riesgo} />
            <VencidosList items={data.vencidos_list} />
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

  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: '#888', lineHeight: 20, marginBottom: 24 },

  loader: { marginTop: 60 },
  errorBox: { alignItems: 'center', marginTop: 60, gap: 12 },
  errorText: { color: '#C0392B', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#A8CFEE', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },


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

  vencidoFill: { height: 7, backgroundColor: '#E07070', borderRadius: 4 },
  vencidoCount: { fontSize: 20, fontWeight: '800', color: '#C0392B', lineHeight: 24 },

  // Salud del hogar
  saludCard: { flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: '#FAFAFA', borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: '#EBEBEB' },
  saludRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  saludScoreNum: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  saludPct: { fontSize: 12, fontWeight: '700', marginTop: -2 },
  saludInfo: { flex: 1, gap: 6 },
  saludTitle: { fontSize: 15, fontWeight: '800', color: '#222' },
  saludBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  saludGrade: { fontSize: 13, fontWeight: '700' },
  saludDesc: { fontSize: 12, color: '#888', lineHeight: 17 },

  // Próximos vencimientos
  proximosList: { gap: 10, paddingBottom: 4 },
  proximoCard: { width: 90, backgroundColor: '#FAFAFA', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EBEBEB' },
  proximoEmoji: { fontSize: 28 },
  proximoName: { fontSize: 11, fontWeight: '600', color: '#333', textAlign: 'center', lineHeight: 15 },
  proximoPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  proximoLabel: { fontSize: 11, fontWeight: '700' },

  // Categorías en riesgo
  riesgoRow: { marginBottom: 16 },
  riesgoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  riesgoNombre: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1 },
  riesgoPct: { fontSize: 14, fontWeight: '800' },
  riesgoTrack: { height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  riesgoFill: { height: 10, borderRadius: 5 },
  riesgoSub: { fontSize: 11, color: '#999' },

  tabBar: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  tabItem: { alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#F0F0F0' },
  tabItemActive: { backgroundColor: '#A8CFEE' },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#999' },
  tabLabelActive: { color: '#fff' },
});
