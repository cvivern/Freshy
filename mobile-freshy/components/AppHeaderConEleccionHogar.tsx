import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type HogarOption = { id: string; name: string };

type Props = {
  hogares: HogarOption[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function AppHeaderConEleccionHogar({ hogares, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const selectedName = hogares.find(h => h.id === selectedId)?.name ?? '—';

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.titleRow} onPress={() => setOpen(true)}>
        <Text style={styles.headerTitle}>freshy</Text>
        <View style={styles.hogarPill}>
          <Text style={styles.hogarText}>{selectedName}</Text>
          <Ionicons name="chevron-down" size={13} color="#fff" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Hogar</Text>
            {hogares.map(hogar => (
              <TouchableOpacity
                key={hogar.id}
                style={[styles.menuItem, hogar.id === selectedId && styles.menuItemActive]}
                onPress={() => { onSelect(hogar.id); setOpen(false); }}
              >
                <Text style={[styles.menuItemText, hogar.id === selectedId && styles.menuItemTextActive]}>
                  {hogar.name}
                </Text>
                {hogar.id === selectedId && <Ionicons name="checkmark" size={18} color="#4A90D9" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#A8CFEE',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  hogarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hogarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 110,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  menuItemActive: {
    backgroundColor: '#F0F7FF',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  menuItemTextActive: {
    fontWeight: '700',
    color: '#4A90D9',
  },
});
