import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
  Switch,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import {
  fetchProfile,
  fetchInventoryItems,
  updateProfile,
  addHouseholdMember,
  fetchCameras,
  fetchStorageAreas,
  fetchHouseholds,
  createCamera,
  updateCamera,
  deleteCamera,
  type UserProfile,
  type ProfileMember,
  type Camera,
  type StorageArea,
  type Household,
} from '@/services/api';
import { apiChangePassword } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import { scheduleWeeklySummary, cancelWeeklySummary } from '@/services/notifications';

// ------- Helpers -------
function formatMemberSince(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ------- Sub-components -------
type SettingRowProps = {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
};

function SettingRow({ iconName, iconColor, iconBg, label, sublabel, onPress, right }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sublabel && <Text style={styles.settingSubLabel}>{sublabel}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color="#CCC" />)}
    </TouchableOpacity>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

// ------- Edit Profile Modal -------
function EditProfileModal({
  visible, currentName, currentEmail, onClose, onSave,
}: {
  visible: boolean;
  currentName: string;
  currentEmail: string;
  onClose: () => void;
  onSave: (name: string, email: string) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(currentName); setEmail(currentEmail); }
  }, [visible]);

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'El nombre y el mail no pueden estar vacíos.');
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), email.trim());
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#888" /></TouchableOpacity>
          </View>
          <Text style={styles.inputLabel}>Nombre</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tu nombre" placeholderTextColor="#BBB" />
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="tu@email.com" placeholderTextColor="#BBB" keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------- Change Password Modal -------
function ChangePasswordModal({
  visible, email, userId, onClose,
}: {
  visible: boolean;
  email: string;
  userId: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setCurrent(''); setNext(''); setConfirm(''); }
  }, [visible]);

  async function handleSave() {
    if (!current || !next || !confirm) {
      Alert.alert('Error', 'Completá todos los campos.');
      return;
    }
    if (next.length < 6) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      await apiChangePassword(userId, email, current, next);
      Alert.alert('¡Listo!', 'Tu contraseña fue actualizada.');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#888" /></TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Contraseña actual</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={current}
              onChangeText={setCurrent}
              placeholder="••••••••"
              placeholderTextColor="#BBB"
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(v => !v)}>
              <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#AAA" />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Nueva contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={next}
              onChangeText={setNext}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#BBB"
              secureTextEntry={!showNext}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNext(v => !v)}>
              <Ionicons name={showNext ? 'eye-off-outline' : 'eye-outline'} size={20} color="#AAA" />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Confirmar nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repetí la nueva contraseña"
            placeholderTextColor="#BBB"
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Actualizar contraseña</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------- Add Member Modal -------
function AddMemberModal({
  visible, onClose, onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (visible) setEmail(''); }, [visible]);

  async function handleAdd() {
    if (!email.trim()) return;
    setAdding(true);
    try {
      await onAdd(email.trim());
      onClose();
    } catch (e: any) {
      Alert.alert('No se pudo agregar', e.message ?? 'Ocurrió un error.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invitar miembro</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#888" /></TouchableOpacity>
          </View>
          <Text style={styles.inputLabel}>Email del miembro</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="miembro@email.com"
            placeholderTextColor="#BBB"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.inputHint}>El usuario debe tener una cuenta en Freshy.</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={adding}>
            {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Agregar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------- Camera Modal -------
function CameraModal({
  visible, onClose, onSave, storageAreas, initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, storageAreaId: string, isActive: boolean) => Promise<void>;
  storageAreas: StorageArea[];
  initial?: Camera | null;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [selectedArea, setSelectedArea] = useState(initial?.storage_area_id ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setSelectedArea(initial?.storage_area_id ?? storageAreas[0]?.id ?? '');
      setIsActive(initial?.is_active ?? true);
    }
  }, [visible]);

  async function handleSave() {
    if (!name.trim() || !selectedArea) {
      Alert.alert('Error', 'Completá nombre y elegí un espacio.');
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), selectedArea, isActive);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? 'Editar cámara' : 'Agregar cámara'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#888" /></TouchableOpacity>
          </View>
          <Text style={styles.inputLabel}>Nombre</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Cámara heladera" placeholderTextColor="#BBB" />
          <Text style={styles.inputLabel}>Espacio</Text>
          <View style={styles.areaList}>
            {storageAreas.map((area, idx) => (
              <TouchableOpacity
                key={area.id ?? String(idx)}
                style={[styles.areaChip, selectedArea === area.id && styles.areaChipActive]}
                onPress={() => setSelectedArea(area.id)}
              >
                <Text style={[styles.areaChipText, selectedArea === area.id && styles.areaChipTextActive]}>
                  {area.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.inputLabel}>Cámara activa (para el monitor)</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#DDD', true: '#A8CFEE' }} thumbColor="#fff" />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------- Main Screen -------
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editVisible, setEditVisible] = useState(false);
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [notifVencimiento, setNotifVencimiento] = useState(true);
  const [notifSemanal, setNotifSemanal] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [addCamVisible, setAddCamVisible] = useState(false);
  const [editCamVisible, setEditCamVisible] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [storageAreas, setStorageAreas] = useState<StorageArea[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    fetchProfile(user.user_id).then(data => {
      setProfile(data);
      setLoadingProfile(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchHouseholds(user.user_id).then(async (hh) => {
      setHouseholds(hh);
      const areaArrays = await Promise.all(hh.map(h => fetchStorageAreas(h.id)));
      const allAreas = areaArrays.flat();
      setStorageAreas(allAreas);

      // Cargar cámaras y auto-crear una si no tiene ninguna
      const existingCams = await fetchCameras(user.user_id);
      if (existingCams.length === 0 && allAreas.length > 0) {
        try {
          await createCamera({
            name: 'Cámara del dispositivo',
            storage_area_id: allAreas[0].id,
            user_id: user.user_id,
            device_identifier: 'device',
            is_active: true,
          });
          // Re-fetch para tener el join completo
          const withJoin = await fetchCameras(user.user_id);
          setCameras(withJoin);
        } catch {
          setCameras([]);
        }
      } else {
        setCameras(existingCams);
      }
    });
  }, [user]);

  async function handleSaveProfile(name: string, email: string) {
    if (!user) return;
    await updateProfile(user.user_id, { name, email });
    setProfile(prev => prev ? { ...prev, name, email } : prev);
    updateUser({ name, email });
  }

  async function handleAddMember(email: string) {
    if (!user) return;
    const newMember = await addHouseholdMember(user.user_id, email);
    setProfile(prev => prev ? { ...prev, members: [...prev.members, newMember] } : prev);
  }

  async function handleToggleWeeklySummary(value: boolean) {
    setNotifSemanal(value);
    if (value) {
      const items = await fetchInventoryItems(user?.user_id ?? '', undefined, user?.access_token);
      await scheduleWeeklySummary(items).catch(() => {});
    } else {
      await cancelWeeklySummary().catch(() => {});
    }
  }

  async function handleAddCamera(name: string, storageAreaId: string) {
    if (!user) return;
    await createCamera({
      name,
      storage_area_id: storageAreaId,
      user_id: user.user_id,
      is_active: cameras.length === 0,
    });
    // Re-fetch para obtener el join completo con storage_areas + households
    const updated = await fetchCameras(user.user_id);
    setCameras(updated);
  }

  async function handleEditCamera(cameraId: string, name: string, storageAreaId: string, isActive: boolean) {
    await updateCamera(cameraId, { name, storage_area_id: storageAreaId, is_active: isActive });
    // Re-fetch para tener datos actualizados con joins
    const updated = await fetchCameras(user.user_id);
    setCameras(updated);
  }

  async function handleDeleteCamera(cameraId: string) {
    Alert.alert('Eliminar cámara', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteCamera(cameraId);
        setCameras(prev => prev.filter(c => c.id !== cameraId));
      }},
    ]);
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Estás seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  const name = profile?.name ?? user?.name ?? '—';
  const email = profile?.email ?? user?.email ?? '—';
  const memberSince = profile?.created_at ? formatMemberSince(profile.created_at) : '—';
  const members: ProfileMember[] = profile?.members ?? [];

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          {loadingProfile ? (
            <ActivityIndicator size="large" color="#A8CFEE" style={{ marginBottom: 16 }} />
          ) : (
            <>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
              </View>
              <Text style={styles.userName}>{name}</Text>
              <Text style={styles.userEmail}>{email}</Text>
              <Text style={styles.memberSince}>Miembro desde {memberSince}</Text>
              <TouchableOpacity style={styles.editProfileBtn} onPress={() => setEditVisible(true)}>
                <Text style={styles.editProfileText}>Editar perfil</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Miembros */}
        <Text style={styles.sectionTitle}>Miembros</Text>
        <SectionCard>
          {members.map((m, idx) => (
            <View key={m.id ?? String(idx)}>
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>{getInitials(m.name)}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
              </View>
              {idx < members.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          {members.length > 0 && <View style={styles.divider} />}
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddMemberVisible(true)}>
            <Ionicons name="person-add-outline" size={16} color="#A8CFEE" />
            <Text style={styles.addBtnText}>Invitar miembro</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Cámaras */}
        <Text style={styles.sectionTitle}>Cámaras</Text>
        <SectionCard>
          {cameras.length === 0 && (
            <Text style={{ color: '#BBB', padding: 16, fontSize: 14 }}>No tenés cámaras configuradas.</Text>
          )}
          {cameras.map((cam, idx) => (
            <View key={cam.id ?? String(idx)}>
              <View style={styles.cameraRow}>
                <View style={[styles.cameraIconWrap, { backgroundColor: cam.is_active ? '#E8F4FF' : '#F5F5F5' }]}>
                  <Ionicons name="videocam-outline" size={20} color={cam.is_active ? '#5B9BD5' : '#BBB'} />
                </View>
                <View style={styles.cameraInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cameraName}>{cam.name}</Text>
                    {cam.is_active && (
                      <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>activa</Text></View>
                    )}
                  </View>
                  <View style={styles.cameraBadges}>
                    {cam.storage_areas?.households?.name && (
                      <View style={styles.cameraBadge}>
                        <Text style={styles.cameraBadgeText}>{cam.storage_areas.households.name}</Text>
                      </View>
                    )}
                    {cam.storage_areas?.name && (
                      <View style={styles.cameraBadge}>
                        <Text style={styles.cameraBadgeText}>{cam.storage_areas.name}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => { setEditingCamera(cam); setEditCamVisible(true); }}>
                    <Ionicons name="pencil-outline" size={18} color="#A8CFEE" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteCamera(cam.id)}>
                    <Ionicons name="trash-outline" size={18} color="#E07070" />
                  </TouchableOpacity>
                </View>
              </View>
              {idx < cameras.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddCamVisible(true)}>
            <Ionicons name="add-circle-outline" size={16} color="#A8CFEE" />
            <Text style={styles.addBtnText}>Agregar cámara</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Notificaciones */}
        <Text style={styles.sectionTitle}>Notificaciones</Text>
        <SectionCard>
          <SettingRow
            iconName="alarm-outline"
            iconColor="#E07820"
            iconBg="#FFF3CD"
            label="Alertas de vencimiento"
            sublabel="Aviso cuando un producto está por vencer"
            right={
              <Switch
                value={notifVencimiento}
                onValueChange={setNotifVencimiento}
                trackColor={{ false: '#DDD', true: '#A8CFEE' }}
                thumbColor="#fff"
              />
            }
          />
          <View style={styles.divider} />
          <SettingRow
            iconName="bar-chart-outline"
            iconColor="#5B9BD5"
            iconBg="#E8F4FF"
            label="Resumen semanal"
            sublabel="Recibe un resumen de tu desperdicio"
            right={
              <Switch
                value={notifSemanal}
                onValueChange={handleToggleWeeklySummary}
                trackColor={{ false: '#DDD', true: '#A8CFEE' }}
                thumbColor="#fff"
              />
            }
          />
        </SectionCard>

        {/* Cuenta */}
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <SectionCard>
          <SettingRow
            iconName="lock-closed-outline"
            iconColor="#888"
            iconBg="#F0F0F0"
            label="Cambiar contraseña"
            onPress={() => setChangePwdVisible(true)}
          />
        </SectionCard>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#C0392B" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>

      <EditProfileModal
        visible={editVisible}
        currentName={name}
        currentEmail={email}
        onClose={() => setEditVisible(false)}
        onSave={handleSaveProfile}
      />

      <ChangePasswordModal
        visible={changePwdVisible}
        email={email}
        userId={user?.user_id ?? ''}
        onClose={() => setChangePwdVisible(false)}
      />

      <AddMemberModal
        visible={addMemberVisible}
        onClose={() => setAddMemberVisible(false)}
        onAdd={handleAddMember}
      />

      <CameraModal
        visible={addCamVisible}
        onClose={() => setAddCamVisible(false)}
        storageAreas={storageAreas}
        onSave={async (name, areaId, isActive) => { await handleAddCamera(name, areaId); }}
      />
      <CameraModal
        visible={editCamVisible}
        onClose={() => { setEditCamVisible(false); setEditingCamera(null); }}
        storageAreas={storageAreas}
        initial={editingCamera}
        onSave={async (name, areaId, isActive) => {
          if (editingCamera) await handleEditCamera(editingCamera.id, name, areaId, isActive);
        }}
      />
    </View>
  );
}

// ------- Styles -------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', marginBottom: 28, paddingTop: 8 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D6EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#A8CFEE',
  },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: '#5B9BD5' },
  userName: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  userEmail: { fontSize: 14, color: '#888', marginTop: 2 },
  memberSince: { fontSize: 12, color: '#AAA', marginTop: 4, marginBottom: 12 },
  editProfileBtn: {
    borderWidth: 1.5,
    borderColor: '#A8CFEE',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  editProfileText: { fontSize: 14, color: '#A8CFEE', fontWeight: '600' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 20 },

  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  settingIconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  settingSubLabel: { fontSize: 12, color: '#999', marginTop: 1 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D6EEF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: { fontSize: 14, fontWeight: '700', color: '#5B9BD5' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  memberEmail: { fontSize: 12, color: '#999' },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13 },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#A8CFEE' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#C5E0F5',
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#C0392B' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 14,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 11 },
  inputHint: { fontSize: 12, color: '#BBB', marginTop: -8, marginBottom: 16 },
  saveBtn: {
    backgroundColor: '#A8CFEE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Camera section
  cameraRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  cameraIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cameraInfo: { flex: 1 },
  cameraName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  cameraBadges: { flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  cameraBadge: { backgroundColor: '#D6EEF8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cameraBadgeText: { fontSize: 11, fontWeight: '600', color: '#3A7FBF' },
  activeBadge: { backgroundColor: '#E8F4FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#5B9BD5' },
  areaList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  areaChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' },
  areaChipActive: { backgroundColor: '#A8CFEE' },
  areaChipText: { fontSize: 13, fontWeight: '600', color: '#888' },
  areaChipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
});
