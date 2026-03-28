import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  View,
  Text,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeaderConEleccionHogar from '@/components/AppHeaderConEleccionHogar';

const FRIDGES = ['Heladera', 'Alacena'];

type FilterState = 'todos' | 'vence_pronto' | 'buen_estado' | 'vencidos';
type SortOption = 'vence_primero' | 'vence_ultimo' | 'nombre_az' | 'mas_reciente';

const FILTERS = [
  { key: 'todos', label: 'Todos los productos' },
  { key: 'vence_pronto', label: 'Vence pronto' },
  { key: 'buen_estado', label: 'En buen estado' },
  { key: 'vencidos', label: 'Vencidos' },
];



type FoodItem = {
  id: number;
  emoji: string;
  name: string;
  category: string;
  brand: string;
  expiryDate: string;
  state: string;
  daysLeft: number;
  shelfLife: number;
};

const MOCK_ITEMS: FoodItem[] = [
  { id: 1, emoji: '🍗', name: 'Pechuga de pollo', category: 'Carnes', brand:'Dia', expiryDate: '27/03/2026', state: 'Descongelada', daysLeft: -1, shelfLife: 3 },
  { id: 2, emoji: '🍎', name: '3 Manzanas', category: 'Frutas', brand:'', expiryDate: '30/03/2026', state: 'Fresca', daysLeft: 2, shelfLife: 7 },
  { id: 3, emoji: '🥛', name: '2 Yogur', category: 'Lácteos', brand: 'Gran compra', expiryDate: '01/04/2026', state: 'Abierto', daysLeft: 4, shelfLife: 10 },
];

function getBorderColor(daysLeft: number) {
  if (daysLeft < 0) return '#E07070';
  if (daysLeft <= 2) return '#E0C050';
  return '#60B870';
}

function getStatusBadge(daysLeft: number): { text: string; bg: string; textColor: string } {
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return { text: `❌  Venció hace ${days} ${days === 1 ? 'día' : 'días'}`, bg: '#FDDEDE', textColor: '#C0392B' };
  }
  if (daysLeft === 0) return { text: '⚠️  Vence hoy', bg: '#FFF0CC', textColor: '#B8860B' };
  if (daysLeft === 1) return { text: '⚠️  Vence mañana', bg: '#FFF0CC', textColor: '#B8860B' };
  return { text: `✅  Vence en ${daysLeft} días`, bg: '#DFF5E3', textColor: '#27AE60' };
}

function getProgress(daysLeft: number, shelfLife: number) {
  const used = shelfLife - daysLeft;
  return Math.min(1, Math.max(0, used / shelfLife));
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
  const [fridgeIndex, setFridgeIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterState>('todos');
  const [activeSort, setActiveSort] = useState<SortOption>('vence_primero');

  const cycleLeft = () => setFridgeIndex(i => (i - 1 + FRIDGES.length) % FRIDGES.length);
  const cycleRight = () => setFridgeIndex(i => (i + 1) % FRIDGES.length);

  const filteredItems = MOCK_ITEMS
  .filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeFilter === 'vence_pronto') return item.daysLeft >= 0 && item.daysLeft <= 2;
    if (activeFilter === 'buen_estado') return item.daysLeft > 2;
    if (activeFilter === 'vencidos') return item.daysLeft < 0;
    return true;
  })
  .sort((a, b) => {
    switch (activeSort) {
      case 'vence_primero':
        return a.daysLeft - b.daysLeft;
      case 'vence_ultimo':
        return b.daysLeft - a.daysLeft;
      case 'nombre_az':
        return a.name.localeCompare(b.name);
      case 'mas_reciente':
        // tri par id décroissant — à remplacer par date d'ajout quand tu auras le champ
        return b.id - a.id;
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      <AppHeaderConEleccionHogar />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        
        {/* Greeting */}
        <Text style={styles.greeting}>Hola Nombre !</Text>

        {/* Fridge selector */}
        <View style={styles.fridgeSelector}>
          <TouchableOpacity onPress={cycleLeft} style={styles.arrowBtn}>
            <Ionicons name="chevron-back" size={22} color="#4A90D9" />
          </TouchableOpacity>
          <View style={styles.fridgeLabelBox}>
            <Text style={styles.fridgeLabelText}>{FRIDGES[fridgeIndex]}</Text>
          </View>
          <TouchableOpacity onPress={cycleRight} style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={22} color="#4A90D9" />
          </TouchableOpacity>
        </View>



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

        {/* Food Items */}
        {filteredItems.map((item) => {
          const badge = getStatusBadge(item.daysLeft);
          const progress = getProgress(item.daysLeft, item.shelfLife);
          return (
            <View key={item.id} style={[styles.foodCard, { borderColor: getBorderColor(item.daysLeft) }]}>
              <View style={styles.cardTopRow}>
                <Text style={styles.foodEmoji}>{item.emoji}</Text><Text style={[styles.foodName,{ flex: 1 }]}>{item.name}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity><Text style={styles.actionIcon}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity><Text style={styles.actionIcon}>🗑️</Text></TouchableOpacity>
                </View>
              </View>

              <Text style={styles.foodCategory}>
                {item.category}{item.brand ? ` - ${item.brand}` : ''}
              </Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: getBorderColor(item.daysLeft) }]} />
              </View>

              <View style={styles.expiryRow}>
                <Text style={styles.expiryLabel}>Vencimiento</Text>
                <Text style={styles.expiryDate}>{item.expiryDate}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1,}}>
                <Text style={styles.foodState}>📝 {item.state}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.text}</Text>
                </View>
              </View>

            </View>
          );
        })}

        <Text style={styles.more}>...</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  fridgeSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18, gap: 8, },
  arrowBtn: { padding: 4 },
  fridgeLabelBox: { flex: 1, borderWidth: 1.5, borderColor: '#A8CFEE', borderRadius: 20, paddingVertical: 8, alignItems: 'center' },
  fridgeLabelText: { fontSize: 17, fontWeight: '600', color: '#222' },
  greeting: { fontSize: 26, fontWeight: '600', color: '#222', marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 8,       // ← même que button
    paddingHorizontal: 12,
    paddingVertical: 8,    // ← même que button
    gap: 6,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,          // ← même que buttonText
    color: '#222',
    paddingVertical: 0,
  },
  subtitle: { fontSize: 20, fontWeight: '600', color: '#222', textAlign: 'center', marginBottom: 20, lineHeight: 28 },
  foodCard: { backgroundColor: '#fff', borderWidth: 2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap:10 },
  foodEmoji: { fontSize: 18 },
  cardActions: { flexDirection: 'row', gap: 10 },
  actionIcon: { fontSize: 20 },
  foodName: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 0, marginTop: 2 },
  foodCategory: { fontSize: 14, color: '#A8CFEE', marginBottom: 8, marginLeft: 35 },
  progressTrack: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  expiryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  expiryLabel: { fontSize: 14, color: '#A8CFEE', paddingLeft:5 },
  expiryDate: { fontSize: 14, fontWeight: '700', color: '#222' },
  foodState: { fontSize: 14, color: '#555', marginBottom: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { fontSize: 14, fontWeight: '600' },
  more: { textAlign: 'center', fontSize: 24, color: '#888', marginTop: 8 },
  
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  
  buttonText: { flex: 1, fontSize: 13, color: '#222' },
  
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 32, borderRadius: 20 },
  menu: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  menuItemActive: { backgroundColor: '#F5F5F5' },
  menuItemText: { flex: 1, fontSize: 15, color: '#444' },
  menuItemTextActive: { fontWeight: '600', color: '#222' },
});