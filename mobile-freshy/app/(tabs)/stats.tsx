import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';

// ------- Types -------
type Period = 'semana' | 'mes' | 'total';

// ------- Mock Data -------
// TODO: reemplazar con queries a Supabase: history_logs + inventory
const DATA: Record<Period, {
  ingresados: number;
  consumidos: number;
  descartados: number;
  fresco: number;
  porVencer: number;
  vencido: number;
  masDesperdiciados: { emoji: string; name: string; brand: string; veces: number }[];
  masRapido: { emoji: string; name: string; brand: string; promedioDias: number }[];
}> = {
  semana: {
    ingresados: 8,
    consumidos: 3,
    descartados: 1,
    fresco: 4,
    porVencer: 2,
    vencido: 1,
    masDesperdiciados: [
      { emoji: '🥦', name: 'Brócoli', brand: 'Campo Verde', veces: 1 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', veces: 1 },
    ],
    masRapido: [
      { emoji: '🥛', name: 'Yogur frutilla', brand: 'Danone', promedioDias: 2 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', promedioDias: 3 },
    ],
  },
  mes: {
    ingresados: 24,
    consumidos: 14,
    descartados: 3,
    fresco: 10,
    porVencer: 4,
    vencido: 3,
    masDesperdiciados: [
      { emoji: '🥦', name: 'Brócoli', brand: 'Campo Verde', veces: 4 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', veces: 3 },
      { emoji: '🧀', name: 'Queso cremoso', brand: 'La Serenísima', veces: 2 },
      { emoji: '🍞', name: 'Pan lactal', brand: 'Bimbo', veces: 1 },
    ],
    masRapido: [
      { emoji: '🥛', name: 'Yogur frutilla', brand: 'Danone', promedioDias: 2 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', promedioDias: 3 },
      { emoji: '🍞', name: 'Pan lactal', brand: 'Bimbo', promedioDias: 4 },
      { emoji: '🥕', name: 'Zanahorias', brand: 'Granja del Sol', promedioDias: 5 },
    ],
  },
  total: {
    ingresados: 87,
    consumidos: 61,
    descartados: 9,
    fresco: 11,
    porVencer: 4,
    vencido: 2,
    masDesperdiciados: [
      { emoji: '🥦', name: 'Brócoli', brand: 'Campo Verde', veces: 11 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', veces: 8 },
      { emoji: '🧀', name: 'Queso cremoso', brand: 'La Serenísima', veces: 6 },
      { emoji: '🍞', name: 'Pan lactal', brand: 'Bimbo', veces: 5 },
      { emoji: '🥕', name: 'Zanahorias', brand: 'Granja del Sol', veces: 3 },
    ],
    masRapido: [
      { emoji: '🥛', name: 'Yogur frutilla', brand: 'Danone', promedioDias: 2 },
      { emoji: '🍗', name: 'Pechuga de pollo', brand: 'Granja del Sol', promedioDias: 3 },
      { emoji: '🍞', name: 'Pan lactal', brand: 'Bimbo', promedioDias: 4 },
      { emoji: '🥕', name: 'Zanahorias', brand: 'Granja del Sol', promedioDias: 5 },
      { emoji: '🧀', name: 'Queso cremoso', brand: 'La Serenísima', promedioDias: 6 },
    ],
  },
};

// ------- Helpers -------
function wastePct(descartados: number, ingresados: number) {
  if (ingresados === 0) return 0;
  return Math.round((descartados / ingresados) * 100);
}

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
  const frescoW = (fresco / total) * 100;
  const porVencerW = (porVencer / total) * 100;
  const vencidoW = (vencido / total) * 100;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Estado actual del inventario</Text>
      <View style={styles.stateBar}>
        {frescoW > 0 && <View style={[styles.stateSegment, { width: `${frescoW}%` as any, backgroundColor: '#60B870' }]} />}
        {porVencerW > 0 && <View style={[styles.stateSegment, { width: `${porVencerW}%` as any, backgroundColor: '#E0C050' }]} />}
        {vencidoW > 0 && <View style={[styles.stateSegment, { width: `${vencidoW}%` as any, backgroundColor: '#E07070' }]} />}
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

function WastedList({ items }: { items: { emoji: string; name: string; brand: string; veces: number }[] }) {
  const max = Math.max(...items.map((i) => i.veces), 1);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🗑️ Más desperdiciados</Text>
      {items.map((item, idx) => (
        <View key={item.name} style={styles.rankRow}>
          <Text style={styles.rankNum}>{idx + 1}</Text>
          <Text style={styles.rankEmoji}>{item.emoji}</Text>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>{item.name}</Text>
            <Text style={styles.rankBrand}>{item.brand}</Text>
            <View style={styles.rankTrack}>
              <View style={[styles.wastedFill, { width: `${(item.veces / max) * 100}%` as any }]} />
            </View>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.wastedCount}>{item.veces}</Text>
            <Text style={styles.rankSubCount}>{item.veces === 1 ? 'vez' : 'veces'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function FastestList({ items }: { items: { emoji: string; name: string; brand: string; promedioDias: number }[] }) {
  const max = Math.max(...items.map((i) => i.promedioDias), 1);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ Se termina más rápido</Text>
      {items.map((item, idx) => (
        <View key={item.name} style={styles.rankRow}>
          <Text style={styles.rankNum}>{idx + 1}</Text>
          <Text style={styles.rankEmoji}>{item.emoji}</Text>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>{item.name}</Text>
            <Text style={styles.rankBrand}>{item.brand}</Text>
            <View style={styles.rankTrack}>
              <View style={[styles.fastFill, { width: `${(item.promedioDias / max) * 100}%` as any }]} />
            </View>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.fastCount}>{item.promedioDias}d</Text>
            <Text style={styles.rankSubCount}>promedio</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ------- Main Screen -------
export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('mes');
  const d = DATA[period];
  const pct = wastePct(d.descartados, d.ingresados);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes', label: 'Este mes' },
    { key: 'total', label: 'Todo' },
  ];

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodChip, period === p.key && styles.periodChipActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodChipText, period === p.key && styles.periodChipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <SummaryCard value={d.ingresados} label="Ingresados" iconName="add-circle-outline" iconColor="#5B9BD5" bgColor="#E8F4FF" />
          <SummaryCard value={d.consumidos} label="Consumidos" iconName="checkmark-done-outline" iconColor="#27AE60" bgColor="#DFF5E3" />
          <SummaryCard value={d.descartados} label="Descartados" iconName="trash-outline" iconColor="#C0392B" bgColor="#FDDEDE" />
          <SummaryCard value={`${pct}%`} label="Desperdicio" iconName="warning-outline" iconColor="#E07820" bgColor="#FFF3CD" />
        </View>

        <StateBar fresco={d.fresco} porVencer={d.porVencer} vencido={d.vencido} />
        <WastedList items={d.masDesperdiciados} />
        <FastestList items={d.masRapido} />
      </ScrollView>
    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  periodChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingVertical: 7,
    alignItems: 'center',
  },
  periodChipActive: { backgroundColor: '#A8CFEE', borderColor: '#A8CFEE' },
  periodChipText: { fontSize: 13, color: '#555', fontWeight: '500' },
  periodChipTextActive: { color: '#fff', fontWeight: '700' },

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
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
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
  rankBadge: { alignItems: 'center', minWidth: 44 },
  rankSubCount: { fontSize: 10, color: '#999' },

  wastedFill: { height: 7, backgroundColor: '#E07070', borderRadius: 4 },
  wastedCount: { fontSize: 20, fontWeight: '800', color: '#C0392B', lineHeight: 24 },

  fastFill: { height: 7, backgroundColor: '#4ABCB0', borderRadius: 4 },
  fastCount: { fontSize: 20, fontWeight: '800', color: '#27856A', lineHeight: 24 },
});
