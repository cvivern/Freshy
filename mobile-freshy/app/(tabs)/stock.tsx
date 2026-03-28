import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ------- Types -------
type StockItem = {
  id: number;
  emoji: string;
  name: string;
  brand: string;
  space: string;   // ej: 'Heladera', 'Alacena', 'Congelados'
  expiryDate: string;  // 'DD/MM/YYYY'
  daysLeft: number;    // negativo = vencido
  shelfLife: number;
};

// ------- Mock Data -------
// TODO: reemplazar con query a Supabase: inventory join storage_areas join catalog_items
const MOCK_STOCK: StockItem[] = [
  {
    id: 1,
    emoji: '🍗',
    name: 'Pechuga de pollo',
    brand: 'Granja del Sol',
    space: 'Heladera',
    expiryDate: '27/03/2026',
    daysLeft: -1,
    shelfLife: 3,
  },
  {
    id: 2,
    emoji: '🧀',
    name: 'Queso cremoso',
    brand: 'La Serenísima',
    space: 'Heladera',
    expiryDate: '05/04/2026',
    daysLeft: 8,
    shelfLife: 20,
  },
  {
    id: 3,
    emoji: '🥛',
    name: 'Yogur frutilla',
    brand: 'Danone',
    space: 'Heladera',
    expiryDate: '31/03/2026',
    daysLeft: 3,
    shelfLife: 14,
  },
  {
    id: 4,
    emoji: '🥫',
    name: 'Atún enlatado',
    brand: 'Albo',
    space: 'Alacena',
    expiryDate: '10/06/2027',
    daysLeft: 440,
    shelfLife: 730,
  },
  {
    id: 5,
    emoji: '🍝',
    name: 'Fideos tallarines',
    brand: 'Matarazzo',
    space: 'Alacena',
    expiryDate: '15/01/2027',
    daysLeft: 293,
    shelfLife: 365,
  },
  {
    id: 6,
    emoji: '🍕',
    name: 'Pizza congelada',
    brand: 'Vizzio',
    space: 'Congelados',
    expiryDate: '01/04/2026',
    daysLeft: 4,
    shelfLife: 90,
  },
  {
    id: 7,
    emoji: '🍦',
    name: 'Helado vainilla',
    brand: 'Frigor',
    space: 'Congelados',
    expiryDate: '28/03/2026',
    daysLeft: 0,
    shelfLife: 180,
  },
];

// ------- Helpers -------
function getStatus(daysLeft: number): {
  label: string;
  bg: string;
  textColor: string;
  borderColor: string;
} {
  if (daysLeft < 0) {
    return {
      label: 'Vencido',
      bg: '#FDDEDE',
      textColor: '#C0392B',
      borderColor: '#E07070',
    };
  }
  if (daysLeft <= 30) {
    return {
      label: daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft}d`,
      bg: '#FFF3CD',
      textColor: '#996600',
      borderColor: '#E0C050',
    };
  }
  return {
    label: 'En buen estado',
    bg: '#DFF5E3',
    textColor: '#27AE60',
    borderColor: '#60B870',
  };
}

function calcStats(items: StockItem[]) {
  const total = items.length;
  const vencidos = items.filter((i) => i.daysLeft < 0).length;
  const porVencer = items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30).length;
  const bienEstado = items.filter((i) => i.daysLeft > 30).length;
  return { total, vencidos, porVencer, bienEstado };
}

// ------- Sub-components -------
function StatCard({
  value,
  label,
  iconName,
  iconColor,
  borderColor,
  bgColor,
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
  const status = getStatus(item.daysLeft);
  return (
    <View style={[styles.productCard, { borderColor: status.borderColor }]}>
      {/* Top: emoji + space chip */}
      <View style={styles.productTopRow}>
        <Text style={styles.productEmoji}>{item.emoji}</Text>
        <View style={styles.spaceChip}>
          <Text style={styles.spaceChipText}>{item.space}</Text>
        </View>
      </View>

      {/* Name */}
      <Text style={styles.productName}>{item.name}</Text>

      {/* Brand */}
      <Text style={styles.productBrand}>{item.brand}</Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, Math.max(0, (item.shelfLife - item.daysLeft) / item.shelfLife) * 100)}%` as any,
              backgroundColor: status.borderColor,
            },
          ]}
        />
      </View>

      {/* Expiry + Status */}
      <View style={styles.productFooter}>
        <View>
          <Text style={styles.expiryLabel}>Vencimiento</Text>
          <Text style={styles.expiryDate}>{item.expiryDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.textColor }]}>
            {status.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ------- Main Screen -------
export default function StockScreen() {
  const [activeFilter, setActiveFilter] = useState<'todos' | 'buen_estado' | 'por_vencer' | 'vencidos'>('todos');

  const stats = calcStats(MOCK_STOCK);

  const filtered = MOCK_STOCK.filter((item) => {
    if (activeFilter === 'todos') return true;
    if (activeFilter === 'vencidos') return item.daysLeft < 0;
    if (activeFilter === 'por_vencer') return item.daysLeft >= 0 && item.daysLeft <= 30;
    if (activeFilter === 'buen_estado') return item.daysLeft > 30;
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>freshy</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Section title */}
        <Text style={styles.sectionTitle}>Resumen del hogar</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            value={stats.total}
            label="Total de productos"
            iconName="cart-outline"
            iconColor="#5B9BD5"
            borderColor="#A8D0F0"
            bgColor="#E8F4FF"
          />
          <StatCard
            value={stats.bienEstado}
            label="En buen estado"
            iconName="checkmark-circle-outline"
            iconColor="#27AE60"
            borderColor="#80CC90"
            bgColor="#DFF5E3"
          />
          <StatCard
            value={stats.porVencer}
            label="Por vencer (≤30 días)"
            iconName="alarm-outline"
            iconColor="#E07820"
            borderColor="#F0C060"
            bgColor="#FFF3CD"
          />
          <StatCard
            value={stats.vencidos}
            label="Vencidos"
            iconName="close-circle-outline"
            iconColor="#C0392B"
            borderColor="#E07070"
            bgColor="#FDDEDE"
          />
        </View>

        {/* Products section */}
        <Text style={styles.sectionTitle}>Todos los productos</Text>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text
                style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Product list */}
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No hay productos en esta categoría.</Text>
        ) : (
          filtered.map((item) => <ProductCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#D4827A',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 14,
    marginTop: 4,
  },

  // Stats
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
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },

  // Filters
  filtersScroll: {
    marginBottom: 16,
  },
  filtersContent: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    borderWidth: 1.5,
    borderColor: '#CCC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: '#D4827A',
    borderColor: '#D4827A',
  },
  filterChipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Product cards
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
  productEmoji: {
    fontSize: 36,
  },
  spaceChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  spaceChipText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 13,
    color: '#4ABCB0',
    marginBottom: 10,
    fontWeight: '500',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#4ABCB0',
    borderRadius: 4,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  expiryLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginTop: 30,
  },
});
