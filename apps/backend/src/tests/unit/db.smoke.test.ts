import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';

describe('db smoke', () => {
  it('cria e busca usuário', async () => {
    const u = await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Test', last_sync_at: new Date() },
    });
    const found = await testPrisma.user.findUnique({ where: { id: u.id } });
    expect(found?.nome).toBe('Test');
  });
});
