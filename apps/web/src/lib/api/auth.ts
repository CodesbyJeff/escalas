import type { AuthUser } from '@escalas/shared-types';
import type { LoginInput } from '@escalas/shared-schemas';
import { apiGet, apiPost } from './client';

export interface LoginResponse { token: string; refresh_token: string; user: AuthUser; }

export const authApi = {
  login: (input: LoginInput) => apiPost<LoginResponse>('/auth/login', input),
  me: () => apiGet<AuthUser>('/auth/me'),
};
