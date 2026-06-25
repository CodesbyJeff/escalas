import type { AuthUser } from '@escalas/shared-types';
import { apiGet, apiPost } from './client';
export interface LoginResponse { token: string; refresh_token: string; user: AuthUser; }
export const authApi = {
  login: (cpf: string, senha: string) => apiPost<LoginResponse>('/auth/login', { cpf, senha }),
  me: () => apiGet<AuthUser>('/auth/me'),
};
