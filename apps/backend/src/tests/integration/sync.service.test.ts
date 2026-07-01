import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';

vi.mock('../../integrations/sisbom/client.js', () => ({
  sisbomClient: {
    getMirrorRef: vi.fn(),
    getEvents: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

import { sisbomClient } from '../../integrations/sisbom/client.js';
import { syncService } from '../../services/sync.service.js';

const mocked = sisbomClient as unknown as {
  getMirrorRef: ReturnType<typeof vi.fn>;
  getEvents: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

const mirror = (militarTs: string) => ({ ref: { militar: militarTs }, server_time: militarTs });

describe('syncService.runOnce', () => {
  it('não faz nada se mirror_ref igual ao cursor', async () => {
    const now = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'militar', last_sync_at: new Date(now), last_mirror_ref_at: new Date(now) },
    });
    mocked.getMirrorRef.mockResolvedValue(mirror(now));
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
    mocked.getMirrorRef.mockResolvedValue(mirror(after));
    mocked.getEvents.mockResolvedValue({
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
    mocked.getMirrorRef.mockResolvedValue(mirror(after));
    mocked.getEvents.mockResolvedValue({
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
    // lotacoes é chamado primeiro (TRACKED: ['lotacoes', 'militar'])
    mocked.getSnapshot
      .mockResolvedValueOnce({ entity: 'lotacoes', items: [], skip: 0, limit: 500, has_more: false })
      .mockResolvedValueOnce({ entity: 'militar', items: [{ _id: 'm1', str_cpf: '10000000001', pessoa: { str_nome: 'A' } }], skip: 0, limit: 500, has_more: true })
      .mockResolvedValueOnce({ entity: 'militar', items: [{ _id: 'm2', str_cpf: '10000000002', pessoa: { str_nome: 'B' } }], skip: 500, limit: 500, has_more: false });
    mocked.getMirrorRef.mockResolvedValue(mirror('2026-05-15T10:00:00Z'));
    await syncService.bulkSnapshot(testPrisma);
    expect(await testPrisma.user.count()).toBe(2);
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'militar' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date('2026-05-15T10:00:00Z').toISOString());
  });
});

describe('syncService.bulkSnapshot — lotações antes de militares', () => {
  it('aplica lotações (ordenadas por nivel) e vincula militares', async () => {
    mocked.getSnapshot.mockImplementation(async ({ entity }: { entity: string }) => {
      if (entity === 'lotacoes') {
        return {
          entity,
          items: [
            { _id: 'id-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'CTIC', _pai: 'DLOF', nivel: '2' },
            { _id: 'id-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_nome: 'DLOF', _pai: '', nivel: '1' },
          ],
          skip: 0, limit: 500, has_more: false,
        };
      }
      return {
        entity, items: [{ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }],
        skip: 0, limit: 500, has_more: false,
      };
    });
    mocked.getMirrorRef.mockResolvedValue({ ref: { lotacoes: null, militar: null }, server_time: '2026-07-01T00:00:00.000Z' });

    await syncService.bulkSnapshot(testPrisma);

    const dlof = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBe(dlof?.id); // pai resolvido apesar de vir antes no array
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.lotacoes[0]?.lotacao_id).toBe(ctic?.id);
  });
});
