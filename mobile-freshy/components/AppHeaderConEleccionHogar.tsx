import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HOGARES = ['Casa', 'Oficina'];

export default function AppHeader() {
  const [selectedHogar, setSelectedHogar] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.titleRow} onPress={() => setOpen(true)}>
        <Text style={styles.headerTitle}>freshy</Text>
        <View style={styles.hogarPill}>
          <Ionicons name="chevron-down" size={13} color="#fff" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Hogar</Text>
            {HOGARES.map(hogar => (
              <TouchableOpacity
                key={hogar}
                style={[styles.menuItem, hogar === selectedHogar && styles.menuItemActive]}
                onPress={() => { setSelectedHogar(hogar); setOpen(false); }}
              >
                <Text style={[styles.menuItemText, hogar === selectedHogar && styles.menuItemTextActive]}>
                  {hogar}
                </Text>
                {hogar === selectedHogar && <Ionicons name="checkmark" size={18} color="#4A90D9" />}
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
    gap: 8,
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    paddingLeft: 12,
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