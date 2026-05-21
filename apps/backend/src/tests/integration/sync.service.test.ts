import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { syncService } from '../../services/sync.service.js';
import { sisbomClient } from '../../integrations/sisbom/client.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

const mirror = (militarTs: string) => ({ ref: { militar: militarTs }, server_time: militarTs });

describe('syncService.runOnce', () => {
  it('não faz nada se mirror_ref igual ao cursor', async () => {
    const now = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'militar', last_sync_at: new Date(now), last_mirror_ref_at: new Date(now) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue(mirror(now));
    const spy = vi.spyOn(sisbomClient, 'getEvents');
    await syncService.runOnce(testPrisma);
    expect(spy).not.toHaveBeenCalled();
  });

  it('puxa eventos quando mirror_ref avança', async () => {
    const before = '2026-05-15T09:00:00Z';
    const after = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'militar', last_sync_at: new Date(before), last_mirror_ref_at: new Date(before) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue(mirror(after));
    vi.spyOn(sisbomClient, 'getEvents').mockResolvedValue({
      events: [{
        id: 'e1', op: 'create', entity: 'militar', entity_id: 'x', at: after,
        data: { _id: 'x', str_cpf: '11122233344', pessoa: { str_nome: 'Z' } },
      }],
      next_since: after, has_more: false, retention_days: 7, is_stale: false,
    });
    await syncService.runOnce(testPrisma);
    const u = await testPrisma.user.findUnique({ where: { cpf: '11122233344' } });
    expect(u?.nome).toBe('Z');
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'militar' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date(after).toISOString());
  });

  it('skip evento com erro, segue processando os próximos, cursor avança', async () => {
    const before = '2026-05-15T09:00:00Z';
    const after = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'militar', last_sync_at: new Date(before), last_mirror_ref_at: new Date(before) },
    });
    // user pré-existente que vai causar conflito de CPF (sisbom_id diferente)
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Pre', sisbom_id: 'preexisting', last_sync_at: new Date(before) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue(mirror(after));
    vi.spyOn(sisbomClient, 'getEvents').mockResolvedValue({
      events: [
        { id: 'bad', op: 'create', entity: 'militar', entity_id: 'novo-evt-ruim', at: '2026-05-15T09:30:00Z', data: { _id: 'novo-evt-ruim', str_cpf: '11122233344', pessoa: { str_nome: 'Conflito' } } },
        { id: 'ok', op: 'create', entity: 'militar', entity_id: 'novo-ok', at: after, data: { _id: 'novo-ok', str_cpf: '22233344455', pessoa: { str_nome: 'OK' } } },
      ],
      next_since: after, has_more: false, retention_days: 7, is_stale: false,
    });
    await syncService.runOnce(testPrisma);
    const ok = await testPrisma.user.findUnique({ where: { cpf: '22233344455' } });
    expect(ok?.nome).toBe('OK');
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'militar' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date(after).toISOString());
  });
});

describe('syncService.bulkSnapshot', () => {
  it('carrega militares via snapshot paginado e alinha o cursor', async () => {
    vi.spyOn(sisbomClient, 'getSnapshot')
      .mockResolvedValueOnce({ entity: 'militar', items: [{ _id: 'm1', str_cpf: '10000000001', pessoa: { str_nome: 'A' } }], skip: 0, limit: 500, has_more: true })
      .mockResolvedValueOnce({ entity: 'militar', items: [{ _id: 'm2', str_cpf: '10000000002', pessoa: { str_nome: 'B' } }], skip: 500, limit: 500, has_more: false });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue(mirror('2026-05-15T10:00:00Z'));
    await syncService.bulkSnapshot(testPrisma);
    expect(await testPrisma.user.count()).toBe(2);
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'militar' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date('2026-05-15T10:00:00Z').toISOString());
  });
});
