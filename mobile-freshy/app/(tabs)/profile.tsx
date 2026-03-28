import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Text,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';

// ------- Types -------
type SettingRowProps = {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
};

// ------- Mock Data -------
// TODO: reemplazar con datos reales de Supabase Auth + profiles
const USER = {
  name: 'Catalina',
  email: 'cata@freshy.app',
  household: 'Casa de Cata',
  avatarEmoji: '👩‍🍳',
  memberSince: 'Marzo 2026',
};

const HOUSEHOLD_MEMBERS = [
  { name: 'Catalina', emoji: '👩‍🍳', role: 'Admin' },
  { name: 'Marcos', emoji: '👨', role: 'Miembro' },
];

// ------- Sub-components -------

function SettingRow({ iconName, iconColor, iconBg, label, sublabel, onPress, right }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
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

// ------- Main Screen -------
export default function ProfileScreen() {
  const [notifVencimiento, setNotifVencimiento] = useState(true);
  const [notifSemanal, setNotifSemanal] = useState(false);

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>{USER.avatarEmoji}</Text>
          </View>
          <Text style={styles.userName}>{USER.name}</Text>
          <Text style={styles.userEmail}>{USER.email}</Text>
          <Text style={styles.memberSince}>Miembro desde {USER.memberSince}</Text>
          <TouchableOpacity style={styles.editProfileBtn}>
            <Text style={styles.editProfileText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Hogar */}
        <Text style={styles.sectionTitle}>Mi hogar</Text>
        <SectionCard>
          <SettingRow
            iconName="home-outline"
            iconColor="#A8CFEE"
            iconBg="#D6EEF8"
            label={USER.household}
            sublabel="Hogar principal"
            onPress={() => {}}
          />
        </SectionCard>

        {/* Miembros */}
        <Text style={styles.sectionTitle}>Miembros</Text>
        <SectionCard>
          {HOUSEHOLD_MEMBERS.map((m, idx) => (
            <View key={m.name}>
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberEmoji}>{m.emoji}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberRole}>{m.role}</Text>
                </View>
                {m.role === 'Admin' && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              {idx < HOUSEHOLD_MEMBERS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.addBtn}>
            <Ionicons name="person-add-outline" size={16} color="#A8CFEE" />
            <Text style={styles.addBtnText}>Invitar miembro</Text>
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
                onValueChange={setNotifSemanal}
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
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingRow
            iconName="help-circle-outline"
            iconColor="#888"
            iconBg="#F0F0F0"
            label="Ayuda y soporte"
            onPress={() => {}}
          />
        </SectionCard>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color="#C0392B" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
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
  avatarEmoji: { fontSize: 44 },
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

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  settingSubLabel: { fontSize: 12, color: '#999', marginTop: 1 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberEmoji: { fontSize: 22 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  memberRole: { fontSize: 12, color: '#999' },
  adminBadge: { backgroundColor: '#D6EEF8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  adminBadgeText: { fontSize: 12, fontWeight: '700', color: '#A8CFEE' },

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
});
