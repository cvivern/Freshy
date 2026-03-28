import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginDemo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Completá tu email y contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError((e.message ?? 'No se pudo iniciar sesión.') + '\n\nUsá el modo demo para probar la app.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setError(null);
    setLoadingDemo(true);
    try {
      await loginDemo();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'No se pudo entrar en modo demo.');
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/logo_blanco_sin_fondo_grande_arbol_recadre.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Tu despensa, siempre fresca</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Iniciar sesión</Text>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#C0392B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            placeholderTextColor="#BBB"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#BBB"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#AAA" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading || loadingDemo}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.loginBtnText}>Entrar</Text>
            }
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.demoBtn, loadingDemo && styles.loginBtnDisabled]}
            onPress={handleDemo}
            disabled={loading || loadingDemo}
            activeOpacity={0.8}
          >
            {loadingDemo
              ? <ActivityIndicator color="#A8CFEE" />
              : <Text style={styles.demoBtnText}>Continuar en modo demo</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Freshy © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#A8CFEE' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 200, height: 90 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4, fontWeight: '500' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginBottom: 20 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0EE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#C0392B', flex: 1 },

  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 16,
  },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48, marginBottom: 24 },
  eyeBtn: { position: 'absolute', right: 14, top: 12 },

  loginBtn: {
    backgroundColor: '#A8CFEE',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EEE' },
  dividerText: { fontSize: 13, color: '#BBB' },

  demoBtn: {
    borderWidth: 1.5,
    borderColor: '#A8CFEE',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  demoBtnText: { color: '#A8CFEE', fontSize: 15, fontWeight: '600' },

  footer: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 32 },
});
