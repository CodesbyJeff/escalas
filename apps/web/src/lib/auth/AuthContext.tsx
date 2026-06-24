import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@escalas/shared-types';
import type { LoginInput } from '@escalas/shared-schemas';
import { authApi } from '../api/auth';
import { clearTokens, getToken, setTokens } from './storage';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => clearTokens()).finally(() => setLoading(false));
  }, []);

  const login = async (input: LoginInput) => {
    const res = await authApi.login(input);
    setTokens(res.token, res.refresh_token);
    setUser(res.user);
  };
  const logout = () => { clearTokens(); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
