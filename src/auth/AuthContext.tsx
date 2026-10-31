import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../services/apiClient';
import type { AuthContextValue, User } from './types';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const [farmerDraft, setFarmerDraft] = useState<Record<string, string> | null>(null);
  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try { const response = await apiFetch<{ user: User }>('/auth/me', { signal: controller.signal }); setUser(response.user); }
    catch { setUser(null); setFarmerDraft(null); }
    finally { window.clearTimeout(timeout); setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onUnauthorized = () => { setUser(null); setFarmerDraft(null); };
    window.addEventListener('cropsense:unauthorized', onUnauthorized);
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { window.removeEventListener('cropsense:unauthorized', onUnauthorized); window.clearInterval(timer); };
  }, [refresh]);
  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setUser(result.user); setFarmerDraft(null); return result.user;
  }, []);
  const register = useCallback(async (email: string, password: string, displayName: string, mobileNumber: string) => {
    const result = await apiFetch<{ user: User }>('/auth/farmer/register', { method: 'POST', body: JSON.stringify({ email, password, display_name: displayName, mobile_number: mobileNumber }) });
    setUser(result.user); setFarmerDraft(null); return result.user;
  }, []);
  const logout = useCallback(async () => { try { await apiFetch('/auth/logout', { method: 'POST', body: '{}' }); } finally { setUser(null); setFarmerDraft(null); } }, []);
  const value = useMemo(() => ({ user, loading, farmerDraft, setFarmerDraft, login, register, logout, refresh }), [user, loading, farmerDraft, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

