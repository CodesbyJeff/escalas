import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';
import { sisbomClient } from '../../integrations/sisbom/client.js';
import { env } from '../../config/env.js';

const ext = new URL(env.SISBOM_EXTERNAL_BASE_URL);

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

  it('getMirrorRef retorna ref por coleção', async () => {
    nock(ext.origin)
      .get(ext.pathname + '/mirror-ref')
      .reply(200, { ref: { militar: '2026-05-15T10:00:00Z', lotacoes: '2026-05-10T08:00:00Z' }, server_time: '2026-05-15T10:00:00Z' });
    const r = await sisbomClient.getMirrorRef();
    expect(r.ref.militar).toBe('2026-05-15T10:00:00Z');
  });

  it('getEvents repassa since/entities e retorna o contrato', async () => {
    nock(ext.origin)
      .get(ext.pathname + '/events')
      .query(true)
      .reply(200, { events: [{ id: 'e1', op: 'create', entity: 'militar', entity_id: 'x', at: '2026-05-15T10:00:00Z', data: { _id: 'x' } }], next_since: '2026-05-15T10:00:00Z', has_more: false, retention_days: 7, is_stale: false });
    const r = await sisbomClient.getEvents({ since: '2026-05-01T00:00:00Z', entities: 'militar' });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.op).toBe('create');
    expect(r.is_stale).toBe(false);
  });

  it('getSnapshot retorna items paginados', async () => {
    nock(ext.origin)
      .get(ext.pathname + '/snapshot')
      .query(true)
      .reply(200, { entity: 'militar', items: [{ _id: 'm1', str_cpf: '10000000001' }], skip: 0, limit: 500, has_more: false });
    const r = await sisbomClient.getSnapshot({ entity: 'militar' });
    expect(r.items).toHaveLength(1);
    expect(r.has_more).toBe(false);
  });
});
