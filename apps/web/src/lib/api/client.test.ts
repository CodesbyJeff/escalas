import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { apiGet, ApiError } from './client';

const BASE = 'http://localhost:3000/api/v1';

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
