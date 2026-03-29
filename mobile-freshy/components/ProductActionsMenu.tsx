import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteInventoryItem, updateInventoryItem, toISODate } from '@/services/api';

type Item = {
  id: string;
  nombre: string;
  marca?: string | null;
  fecha_vencimiento?: string | null;
  emoji?: string | null;
};

type Props = {
  item: Item;
  token?: string | null;
  onDeleted: (id: string) => void;
  onUpdated: (id: string, fields: Partial<Item>) => void;
};

export default function ProductActionsMenu({ item, token, onDeleted, onUpdated }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [nombre, setNombre] = useState(item.nombre);
  const [marca, setMarca] = useState(item.marca ?? '');
  const [fecha, setFecha] = useState(
    item.fecha_vencimiento
      ? item.fecha_vencimiento.split('-').reverse().join('/')
      : ''
  );
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setNombre(item.nombre);
    setMarca(item.marca ?? '');
    setFecha(item.fecha_vencimiento ? item.fecha_vencimiento.split('-').reverse().join('/') : '');
    setMenuVisible(false);
    setEditVisible(true);
  }

  function handleDelete() {
    setMenuVisible(false);
    Alert.alert(
      'Borrar producto',
      `¿Seguro que querés borrar "${item.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInventoryItem(item.id, token);
              onDeleted(item.id);
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'No se pudo borrar el producto.');
            }
          },
        },
      ]
    );
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const fields: Partial<Item> = { nombre: nombre.trim(), marca: marca.trim() || undefined };
      if (fecha.trim()) {
        fields.fecha_vencimiento = toISODate(fecha.trim());
      }
      await updateInventoryItem(item.id, fields as any, token);
      onUpdated(item.id, fields);
      setEditVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.dotsBtn}>
        <Ionicons name="ellipsis-vertical" size={18} color="#AAA" />
      </TouchableOpacity>

      {/* Menú */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={s.menu}>
            <TouchableOpacity style={s.menuItem} onPress={openEdit}>
              <Ionicons name="create-outline" size={18} color="#444" />
              <Text style={s.menuItemText}>Editar</Text>
            </TouchableOpacity>
            <View style={s.menuDivider} />
            <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#C0392B" />
              <Text style={[s.menuItemText, { color: '#C0392B' }]}>Borrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edición */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={s.editOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.editSheet}>
            <View style={s.editHeader}>
              <Text style={s.editTitle}>Editar producto</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Nombre *</Text>
            <TextInput style={s.input} value={nombre} onChangeText={setNombre} placeholder="Nombre del producto" placeholderTextColor="#BBB" />

            <Text style={s.label}>Marca</Text>
            <TextInput style={s.input} value={marca} onChangeText={setMarca} placeholder="Opcional" placeholderTextColor="#BBB" />

            <Text style={s.label}>Fecha de vencimiento</Text>
            <TextInput
              style={s.input}
              value={fecha}
              onChangeText={setFecha}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#BBB"
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[s.saveBtn, (!nombre.trim() || saving) && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!nombre.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  dotsBtn: { padding: 4 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', paddingBottom: 40, paddingHorizontal: 20 },
  menu: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontSize: 16, color: '#444', fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A1A1A', marginBottom: 16 },
  saveBtn: { backgroundColor: '#A8CFEE', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
