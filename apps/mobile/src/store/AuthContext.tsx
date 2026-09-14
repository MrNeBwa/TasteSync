import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { request, register as registerApi, type User } from '../lib/api';
import { clearAuth, loadAuth, saveAuth, saveUser } from '../lib/auth';

type AuthContextValue = {
  loading: boolean;
  token: string;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string) => Promise<User>;
  refreshMe: () => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadAuth();
        if (!stored) return;
        const me = await request<User>('/auth/me', {}, stored.access);
        setToken(stored.access);
        setUser(me);
        await saveUser(me);
      } catch {
        await clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const result = await request<{ access_token: string; refresh_token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    const me = await request<User>('/auth/me', {}, result.access_token);
    await saveAuth(result.access_token, result.refresh_token, me);
    setToken(result.access_token);
    setUser(me);
    return me;
  }

  async function register(username: string, email: string, password: string) {
    const result = await registerApi(username, email, password);
    const me = await request<User>('/auth/me', {}, result.access_token);
    await saveAuth(result.access_token, result.refresh_token, me);
    setToken(result.access_token);
    setUser(me);
    return me;
  }

  async function refreshMe() {
    if (!token) throw new Error('Not authenticated');
    const me = await request<User>('/auth/me', {}, token);
    setUser(me);
    await saveUser(me);
    return me;
  }

  async function logout() {
    await clearAuth();
    setToken('');
    setUser(null);
  }

  const value = useMemo(() => ({ loading, token, user, login, register, refreshMe, logout }), [loading, token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
