import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';
import { authApi } from '../api/auth';
import { getToken, setTokens, clearTokens } from './storage';

interface Ctx { user: AuthUser | null; loading: boolean; login: (cpf: string, senha: string) => Promise<void>; logout: () => Promise<void>; }
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (!(await getToken())) { setLoading(false); return; }
      try { setUser(await authApi.me()); } catch { await clearTokens(); } finally { setLoading(false); }
    })();
  }, []);
  const login = async (cpf: string, senha: string) => {
    const res = await authApi.login(cpf, senha);
    await setTokens(res.token, res.refresh_token);
    setUser(res.user);
  };
  const logout = async () => { await clearTokens(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
