import * as SecureStore from 'expo-secure-store';
import { DEFAULT_USER_ID } from './api';

const SUPABASE_URL = 'https://hrnyymqkpqzlemnqcsll.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhybnl5bXFrcHF6bGVtbnFjc2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Njk3ODUsImV4cCI6MjA5MDI0NTc4NX0.UW70x9HXtzReeaKJ0-xT8T-FRLjztSIFCwyWZvqWR0w';

const SESSION_KEY = 'freshy_session';

export type Session = {
  user_id: string;
  name: string;
  email: string;
  created_at: string | null;
  access_token?: string;
};

// ------- Persistence -------

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ------- Supabase Auth helpers -------

async function supabaseAuthFetch(path: string, body: object, accessToken?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.msg ?? 'Error de autenticación');
  }
  return data;
}

// ------- API calls -------

export async function apiLogin(email: string, password: string): Promise<Session> {
  const data = await supabaseAuthFetch(
    '/token?grant_type=password',
    { email, password }
  );

  const userId = data.user?.id ?? '';
  const userEmail = data.user?.email ?? email;

  // Try to get name from profiles
  let name = userEmail;
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=name,created_at`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${data.access_token}` } }
    );
    const profiles = await profileRes.json();
    if (profiles?.[0]?.name) name = profiles[0].name;
  } catch {}

  return {
    user_id: userId,
    name,
    email: userEmail,
    created_at: data.user?.created_at ?? null,
    access_token: data.access_token,
  };
}

export async function apiChangePassword(
  _userId: string,
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
  }

  // Verify current password by signing in
  const loginData = await supabaseAuthFetch(
    '/token?grant_type=password',
    { email, password: currentPassword }
  );

  // Update password using the obtained access token
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${loginData.access_token}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error_description ?? data.msg ?? 'No se pudo cambiar la contraseña');
  }
}

export function demoLogin(): Session {
  return {
    user_id: DEFAULT_USER_ID,
    name: 'Sergio Lezama',
    email: 'user1@freshy.com',
    created_at: null,
  };
}
