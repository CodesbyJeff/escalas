import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { syncService } from '../../services/sync.service.js';
import { sisbomClient } from '../../integrations/sisbom/client.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('syncService.runOnce', () => {
  it('não faz nada se mirror_ref igual ao cursor', async () => {
    const now = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'users', last_sync_at: new Date(now), last_mirror_ref_at: new Date(now) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue({ users: now, lotacoes: now });
    const spy = vi.spyOn(sisbomClient, 'getEvents');
    await syncService.runOnce(testPrisma);
    expect(spy).not.toHaveBeenCalled();
  });

  it('puxa eventos quando mirror_ref avança', async () => {
    const before = '2026-05-15T09:00:00Z';
    const after = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'users', last_sync_at: new Date(before), last_mirror_ref_at: new Date(before) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue({ users: after, lotacoes: before });
    vi.spyOn(sisbomClient, 'getEvents').mockResolvedValue({
      events: [{
        entity: 'users', type: 'new',
        data: { _id: 'x', str_cpf: '11122233344', str_nome: 'Z' },
        timestamp: after,
      }],
      next_cursor: null,
      has_more: false,
    });
    await syncService.runOnce(testPrisma);
    const u = await testPrisma.user.findUnique({ where: { cpf: '11122233344' } });
    expect(u?.nome).toBe('Z');
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'users' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date(after).toISOString());
  });

  it('skip evento com erro, segue processando os próximos, cursor avança', async () => {
    const before = '2026-05-15T09:00:00Z';
    const after = '2026-05-15T10:00:00Z';
    await testPrisma.syncCursor.create({
      data: { entidade: 'users', last_sync_at: new Date(before), last_mirror_ref_at: new Date(before) },
    });
    // user pré-existente que vai causar conflito de CPF
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Pre', sisbom_id: 'preexisting', last_sync_at: new Date(before) },
    });
    vi.spyOn(sisbomClient, 'getMirrorRef').mockResolvedValue({ users: after, lotacoes: before });
    vi.spyOn(sisbomClient, 'getEvents').mockResolvedValue({
      events: [
        // este vai falhar (cpf duplicado em sisbom_id diferente)
        { entity: 'users', type: 'new', data: { _id: 'novo-evt-ruim', str_cpf: '11122233344', str_nome: 'Conflito' }, timestamp: '2026-05-15T09:30:00Z' },
        // este precisa passar normalmente
        { entity: 'users', type: 'new', data: { _id: 'novo-ok', str_cpf: '22233344455', str_nome: 'OK' }, timestamp: after },
      ],
      next_cursor: null,
      has_more: false,
    });
    await syncService.runOnce(testPrisma);
    const ok = await testPrisma.user.findUnique({ where: { cpf: '22233344455' } });
    expect(ok?.nome).toBe('OK');
    const cursor = await testPrisma.syncCursor.findUnique({ where: { entidade: 'users' } });
    expect(cursor?.last_mirror_ref_at.toISOString()).toBe(new Date(after).toISOString());
  });
});
