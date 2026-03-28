import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiLogin, clearSession, loadSession, saveSession, type Session } from '@/services/auth';

type AuthContextType = {
  user: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (fields: Partial<Session>) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  loginDemo: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession().then(session => {
      setUser(session);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const session = await apiLogin(email, password);
    await saveSession(session);
    setUser(session);
  }

  async function loginDemo() {
    const session = await apiLogin('slezamaorihuela@itba.edu.ar', '123123');
    await saveSession(session);
    setUser(session);
  }

  async function logout() {
    await clearSession();
    setUser(null);
  }

  function updateUser(fields: Partial<Session>) {
    setUser(prev => prev ? { ...prev, ...fields } : prev);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginDemo, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
