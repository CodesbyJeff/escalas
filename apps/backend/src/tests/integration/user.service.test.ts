import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { userService } from '../../services/user.service.js';

describe('userService.applyEvent', () => {
  it('cria user com op=create', async () => {
    await userService.applyEvent(
      {
        id: 'evt1', op: 'create', entity: 'militar', entity_id: 'abc', at: '2026-05-15T10:00:00Z',
        data: { _id: 'abc', str_cpf: '11122233344', pessoa: { str_nome: 'Fulano' }, str_matricula: '123-4', str_nomecurto: 'FUL', ativo: true },
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { cpf: '11122233344' } });
    expect(u?.nome).toBe('Fulano');
    expect(u?.sisbom_id).toBe('abc');
    expect(u?.nome_curto).toBe('FUL');
    expect(u?.matricula).toBe('1234');
  });

  it('atualiza com op=patch usando sisbom_id', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Old', sisbom_id: 'abc', last_sync_at: new Date(), matricula: '1234' },
    });
    await userService.applyEvent(
      {
        id: 'e2', op: 'patch', entity: 'militar', entity_id: 'abc', at: '2026-05-15T11:00:00Z',
        data: { _id: 'abc', str_cpf: '11122233344', pessoa: { str_nome: 'New' } },
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.nome).toBe('New');
  });

  it('inativa com op=delete', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'X', sisbom_id: 'abc', last_sync_at: new Date() },
    });
    await userService.applyEvent(
      { id: 'e3', op: 'delete', entity: 'militar', entity_id: 'abc', at: '2026-05-15T12:00:00Z', data: null },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.ativo).toBe(false);
  });

  it('inativa com op=remove usando entity_id (data null)', async () => {
    await testPrisma.user.create({
      data: { cpf: '99988877766', nome: 'Y', sisbom_id: 'rem', last_sync_at: new Date() },
    });
    await userService.applyEvent(
      { id: 'e4', op: 'remove', entity: 'militar', entity_id: 'rem', at: '2026-05-15T12:00:00Z', data: null },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'rem' } });
    expect(u?.ativo).toBe(false);
  });

  it('ignora evento de entity diferente de militar', async () => {
    await userService.applyEvent(
      { id: 'e5', op: 'create', entity: 'lotacoes', entity_id: 'L', at: '2026-05-15T10:00:00Z', data: { _id: 'L' } },
      testPrisma,
    );
    expect(await testPrisma.user.count()).toBe(0);
  });
});
