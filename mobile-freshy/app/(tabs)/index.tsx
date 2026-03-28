import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';

const FRIDGES = ['Casa', 'Oficina'];

type FoodItem = {
  id: number;
  emoji: string;
  name: string;
  category: string;
  expiryDate: string;   // 'DD/MM/YYYY'
  state: string;        // ej: 'Descongelada', 'Abierto'
  daysLeft: number;     // negativo = vencido
  shelfLife: number;    // días totales de vida útil
};

const MOCK_ITEMS: FoodItem[] = [
  {
    id: 1,
    emoji: '🍗',
    name: 'Pechuga de pollo',
    category: 'Carnes',
    expiryDate: '27/03/2026',
    state: 'Descongelada',
    daysLeft: -1,
    shelfLife: 3,
  },
  {
    id: 2,
    emoji: '🍎',
    name: '3 Manzanas',
    category: 'Frutas',
    expiryDate: '30/03/2026',
    state: 'Fresca',
    daysLeft: 2,
    shelfLife: 7,
  },
  {
    id: 3,
    emoji: '🥛',
    name: '2 Yogur',
    category: 'Lácteos',
    expiryDate: '01/04/2026',
    state: 'Abierto',
    daysLeft: 4,
    shelfLife: 10,
  },
];

function getBorderColor(daysLeft: number) {
  if (daysLeft < 0) return '#E07070';
  if (daysLeft <= 2) return '#E0C050';
  return '#60B870';
}

function getStatusBadge(daysLeft: number): { text: string; bg: string; textColor: string } {
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return {
      text: `❌  Venció hace ${days} ${days === 1 ? 'día' : 'días'}`,
      bg: '#FDDEDE',
      textColor: '#C0392B',
    };
  }
  if (daysLeft === 0) {
    return { text: '⚠️  Vence hoy', bg: '#FFF0CC', textColor: '#B8860B' };
  }
  if (daysLeft === 1) {
    return { text: '⚠️  Vence mañana', bg: '#FFF0CC', textColor: '#B8860B' };
  }
  return {
    text: `✅  Vence en ${daysLeft} días`,
    bg: '#DFF5E3',
    textColor: '#27AE60',
  };
}

function getProgress(daysLeft: number, shelfLife: number) {
  const used = shelfLife - daysLeft;
  return Math.min(1, Math.max(0, used / shelfLife));
}

export default function HomeScreen() {
  const [selectedFridge, setSelectedFridge] = useState('Casa');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Heladera selector */}
        <View style={styles.fridgeRow}>
          <View>
            <Text style={styles.fridgeLabel}>Heladera :</Text>
            <Text style={styles.fridgeHint}>Falta la parte de heladera{'\n'}o alacena aqui</Text>
          </View>
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setDropdownOpen(!dropdownOpen)}
            >
              <Ionicons name="caret-down-outline" size={14} color="#444" />
              <Text style={styles.dropdownText}>{selectedFridge}</Text>
              <Ionicons name="checkmark" size={14} color="#444" />
            </TouchableOpacity>
            {dropdownOpen &&
              FRIDGES.filter((f) => f !== selectedFridge).map((fridge) => (
                <TouchableOpacity
                  key={fridge}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedFridge(fridge);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{fridge}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>Hola Nombre !</Text>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#888" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder=""
            />
          </View>
          <Text style={styles.searchHint}>algo para elegir el estado{'\n'}y tambien el historia</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Aqui estan las cosas que tienes{'\n'}que comer en primero
        </Text>

        {/* Food Items */}
        {MOCK_ITEMS.map((item) => {
          const badge = getStatusBadge(item.daysLeft);
          const progress = getProgress(item.daysLeft, item.shelfLife);
          return (
            <View
              key={item.id}
              style={[styles.foodCard, { borderColor: getBorderColor(item.daysLeft) }]}
            >
              {/* Top row */}
              <View style={styles.cardTopRow}>
                <Text style={styles.foodEmoji}>{item.emoji}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity>
                    <Text style={styles.actionIcon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.actionIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Name & category */}
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={styles.foodCategory}>{item.category}</Text>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: getBorderColor(item.daysLeft) }]} />
              </View>

              {/* Expiry row */}
              <View style={styles.expiryRow}>
                <Text style={styles.expiryLabel}>Vencimiento</Text>
                <Text style={styles.expiryDate}>{item.expiryDate}</Text>
              </View>

              {/* State */}
              <Text style={styles.foodState}>📝 {item.state}</Text>

              {/* Status badge */}
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.textColor }]}>{badge.text}</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  fridgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  fridgeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  fridgeHint: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  dropdownWrapper: {
    flex: 1,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#aaa',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
  },
  dropdownItem: {
    borderWidth: 1.5,
    borderColor: '#aaa',
    borderTopWidth: 0,
    borderRadius: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#aaa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flex: 1,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },
  searchHint: {
    fontSize: 11,
    color: '#888',
    textAlign: 'left',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 28,
  },
  foodCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  foodEmoji: {
    fontSize: 36,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionIcon: {
    fontSize: 20,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  foodCategory: {
    fontSize: 14,
    color: '#4ABCB0',
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#4ABCB0',
    borderRadius: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  expiryLabel: {
    fontSize: 14,
    color: '#4ABCB0',
  },
  expiryDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  foodState: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  more: {
    textAlign: 'center',
    fontSize: 24,
    color: '#888',
    marginTop: 8,
  },
});
