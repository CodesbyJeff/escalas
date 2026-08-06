import { http, HttpResponse } from 'msw';
import { afterEach, expect, it } from 'vitest';
import { server } from '../../test/msw';
import { apiGet, apiPost, ApiError } from './client';
import { setTokens, getToken } from '../auth/storage';

const BASE = 'http://localhost:3000/api/v1';

afterEach(() => localStorage.clear());

it('apiGet retorna data do envelope {success,data}', async () => {
  server.use(http.get(`${BASE}/ping`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: { pong: true } }),
  ));
  await expect(apiGet('/ping')).resolves.toEqual({ pong: true });
});

it('apiGet lança ApiError com status e message em falha', async () => {
  server.use(http.get(`${BASE}/x`, () =>
    HttpResponse.json({ success: false, message: 'Sem permissão.', data: null }, { status: 403 }),
  ));
  await expect(apiGet('/x')).rejects.toMatchObject({ status: 403, message: 'Sem permissão.' });
  await expect(apiGet('/x')).rejects.toBeInstanceOf(ApiError);
});

it('401 no login mostra o motivo do servidor, não "sessão expirada"', async () => {
  server.use(http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ success: false, message: 'CPF ou senha inválidos.' }, { status: 401 }),
  ));
  await expect(apiPost('/auth/login', { cpf: '1', senha: 'errada' }))
    .rejects.toMatchObject({ status: 401, message: 'CPF ou senha inválidos.' });
});

it('login que falha não derruba a sessão de quem já estava logado', async () => {
  setTokens('token-valido', 'refresh-valido');
  server.use(http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ success: false, message: 'CPF ou senha inválidos.' }, { status: 401 }),
  ));
  await expect(apiPost('/auth/login', { cpf: '1', senha: 'errada' })).rejects.toBeInstanceOf(ApiError);
  expect(getToken()).toBe('token-valido');
});

it('429 sem corpo vira aviso de excesso de tentativas', async () => {
  server.use(http.post(`${BASE}/auth/login`, () => new HttpResponse(null, { status: 429 })));
  await expect(apiPost('/auth/login', { cpf: '1', senha: 'x' }))
    .rejects.toMatchObject({ status: 429, message: 'Muitas tentativas. Aguarde um minuto e tente de novo.' });
});

it('resposta sem corpo em outro status ainda cai na mensagem genérica', async () => {
  server.use(http.get(`${BASE}/y`, () => new HttpResponse(null, { status: 500 })));
  await expect(apiGet('/y')).rejects.toMatchObject({ status: 500, message: 'Erro de comunicação.' });
});
