import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { userService } from '../../services/user.service.js';

describe('userService.applyEvent', () => {
  it('cria user com type=new', async () => {
    await userService.applyEvent(
      {
        entity: 'users',
        type: 'new',
        data: { _id: 'abc', str_cpf: '11122233344', str_nome: 'Fulano', str_matricula: '123-4', lotacao: [] },
        timestamp: '2026-05-15T10:00:00Z',
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { cpf: '11122233344' } });
    expect(u?.nome).toBe('Fulano');
    expect(u?.sisbom_id).toBe('abc');
  });

  it('atualiza com type=upd usando sisbom_id', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Old', sisbom_id: 'abc', last_sync_at: new Date(), matricula: '1234' },
    });
    await userService.applyEvent(
      {
        entity: 'users',
        type: 'upd',
        data: { _id: 'abc', str_cpf: '11122233344', str_nome: 'New', str_matricula: '123-4', lotacao: [] },
        timestamp: '2026-05-15T11:00:00Z',
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.nome).toBe('New');
  });

  it('inativa com type=del', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'X', sisbom_id: 'abc', last_sync_at: new Date() },
    });
    await userService.applyEvent(
      {
        entity: 'users',
        type: 'del',
        data: { _id: 'abc' },
        timestamp: '2026-05-15T12:00:00Z',
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.ativo).toBe(false);
  });
});
