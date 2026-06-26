import { getToken, getRefreshToken, setToken, clearTokens } from '../auth/storage';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

async function refresh(): Promise<boolean> {
  const refresh_token = await getRefreshToken();
  if (!refresh_token) return false;
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token }) });
  if (!res.ok) return false;
  const body = await res.json();
  if (!body.success || !body.data?.token) return false;
  await setToken(body.data.token);
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !retried) {
    if (await refresh()) return request<T>(method, path, body, true);
    await clearTokens();
    throw new ApiError(401, 'Sessão expirada.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.success) throw new ApiError(res.status, json?.message ?? 'Erro de comunicação.');
  return json.data as T;
}

export const apiGet = <T>(path: string) => request<T>('GET', path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
