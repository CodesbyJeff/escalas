import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';
import { sisbomClient } from '../../integrations/sisbom/client.js';

afterEach(() => nock.cleanAll());

describe('SisbomClient', () => {
  it('loginAd retorna true em 200', async () => {
    nock('https://api.sisbom.cbm.rn.gov.br')
      .post('/api/login-ad')
      .reply(200, { success: true });
    expect(await sisbomClient.loginAd('11122233344', 'senha')).toBe(true);
  });

  it('loginAd retorna false em 401', async () => {
    nock('https://api.sisbom.cbm.rn.gov.br')
      .post('/api/login-ad')
      .reply(401, { error: 'unauthorized' });
    expect(await sisbomClient.loginAd('11122233344', 'errada')).toBe(false);
  });

  it('loginAd propaga erro 5xx', async () => {
    nock('https://api.sisbom.cbm.rn.gov.br')
      .post('/api/login-ad')
      .reply(503);
    await expect(sisbomClient.loginAd('11122233344', 'senha')).rejects.toThrow();
  });

  it('getMirrorRef retorna timestamps', async () => {
    nock('https://api.sisbom.cbm.rn.gov.br')
      .get('/api/v1/external/mirror-ref')
      .reply(200, { users: '2026-05-15T10:00:00Z', lotacoes: '2026-05-10T08:00:00Z' });
    const r = await sisbomClient.getMirrorRef();
    expect(r.users).toBe('2026-05-15T10:00:00Z');
  });
});
