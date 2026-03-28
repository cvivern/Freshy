import * as SecureStore from 'expo-secure-store';
import { API_BASE, fetchWithTimeout } from './api';

const SESSION_KEY = 'freshy_session';

export type Session = {
  user_id: string;
  name: string;
  email: string;
  created_at: string | null;
  access_token?: string | null;
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

// ------- API calls -------

export async function apiLogin(email: string, password: string): Promise<Session> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/v1/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? 'Error de autenticación');
  }

  return {
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    created_at: data.created_at ?? null,
    access_token: data.access_token ?? null,
  };
}

export async function apiRegister(name: string, email: string, password: string): Promise<Session> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/v1/auth/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail ?? 'Error al crear la cuenta');
  }

  return {
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    created_at: null,
  };
}

export async function apiChangePassword(
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/v1/auth/change-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        email,
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? 'No se pudo cambiar la contraseña');
  }
}

export function demoLogin(): Session {
  return {
    user_id: '00000000-0000-0000-0000-000000000101',
    name: 'Sergio Lezama',
    email: 'user1@freshy.com',
    created_at: null,
  };
}
