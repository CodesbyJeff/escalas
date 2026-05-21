import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { auditService } from '../../services/audit.service.js';

describe('auditService.log', () => {
  it('grava um registro de auditoria', async () => {
    const user = await testPrisma.user.create({
      data: { cpf: '10101010101', nome: 'U', last_sync_at: new Date() },
    });
    await auditService.log(
      {
        user_id: user.id,
        acao: 'criar',
        entidade: 'Escala',
        entidade_id: 123,
        antes: null,
        depois: { status: 'rascunho' },
      },
      testPrisma,
    );
    const logs = await testPrisma.auditLog.findMany({ where: { entidade: 'Escala', entidade_id: 123 } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.acao).toBe('criar');
    expect(logs[0]!.payload_depois).toEqual({ status: 'rascunho' });
  });
});
