import type { ApiResponse } from '@escalas/shared-types';
import { getToken, getRefreshToken, setToken, clearTokens } from '../auth/storage';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshToken(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as ApiResponse<{ token: string }>;
  if (!body.success) return false;
  setToken(body.data.token);
  return true;
}

// Rotas que estabelecem a sessão. Um 401 aqui é credencial recusada, não sessão morta:
// não faz sentido tentar renovar (não há o que renovar) nem derrubar quem já estava logado.
const ROTAS_DE_AUTENTICACAO = ['/auth/login', '/auth/refresh'];

// Nem toda resposta traz envelope: o rate limiter, por exemplo, responde 429 com corpo
// vazio. Sem isto o usuário lê "Erro de comunicação" e não faz ideia de que se bloqueou.
function mensagemSemCorpo(status: number): string {
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  return 'Erro de comunicação.';
}

async function request<T>(method: string, path: string, body?: unknown, _retried = false): Promise<T> {
  const ehAutenticacao = ROTAS_DE_AUTENTICACAO.some((rota) => path.startsWith(rota));
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && !_retried && !ehAutenticacao) {
    if (await refreshToken()) return request<T>(method, path, body, true);
    clearTokens();
    throw new ApiError(401, 'Sessão expirada.');
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !json || !json.success) {
    throw new ApiError(res.status, json?.message ?? mensagemSemCorpo(res.status));
  }
  return json.data;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
export const apiPut = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
export const apiDelete = <T>(path: string) => request<T>('DELETE', path);
