import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AppHeader from '@/components/AppHeader';

type FavoriteProduct = {
  id: number;
  emoji: string;
  name: string;
};

const FAVORITE_PRODUCTS: FavoriteProduct[] = [
  { id: 1, emoji: '🍞', name: 'Pan' },
  { id: 2, emoji: '🧈', name: 'Manteca' },
  { id: 3, emoji: '🍌', name: 'Banana' },
];

export default function AddScreen() {
  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Botón para escanear producto */}
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeButton}>
            <Text style={styles.modeButtonText}>
              📷  Escanear
            </Text>
          </TouchableOpacity>
        </View>

        {/* Descripción */}
        <Text style={styles.description}>
          Aqui estan tus productos favoritos. Si has comprado algo de nuevo, puedes añadirlo aqui sin escanearlo
        </Text>

        {/* Lista de productos favoritos */}
        {FAVORITE_PRODUCTS.map((product) => (
          <View key={product.id} style={styles.productRow}>
            <Text style={styles.productEmoji}>{product.emoji}</Text>
            <Text style={styles.productName}>{product.name}</Text>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#222',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 24,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#222',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  productName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: '#222',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
  },
});
