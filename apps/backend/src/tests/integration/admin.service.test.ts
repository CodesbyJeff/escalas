import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { adminService } from '../../services/admin.service.js';

async function seedUserAndLotacao() {
  const lotacao = await testPrisma.lotacao.create({
    data: { id: 999, sigla: 'TEST', nome: 'Test', nivel: 1, operacional: true },
  });
  const user = await testPrisma.user.create({
    data: { cpf: '11122233344', nome: 'U', last_sync_at: new Date() },
  });
  const admin = await testPrisma.user.create({
    data: { cpf: '99988877766', nome: 'A', is_super_admin: true, last_sync_at: new Date() },
  });
  return { lotacao, user, admin };
}

describe('admin.service.atribuirRole', () => {
  it('cria role para user em lotação', async () => {
    const { user, lotacao, admin } = await seedUserAndLotacao();
    const r = await adminService.atribuirRole(
      { user_id: user.id, role: 'ESCALANTE', lotacao_id: lotacao.id },
      admin.id,
      testPrisma,
    );
    expect(r.role).toBe('ESCALANTE');
    expect(r.lotacao_id).toBe(lotacao.id);
  });

  it('idempotente: chamar duas vezes não duplica', async () => {
    const { user, lotacao, admin } = await seedUserAndLotacao();
    await adminService.atribuirRole(
      { user_id: user.id, role: 'ESCALANTE', lotacao_id: lotacao.id },
      admin.id,
      testPrisma,
    );
    await adminService.atribuirRole(
      { user_id: user.id, role: 'ESCALANTE', lotacao_id: lotacao.id },
      admin.id,
      testPrisma,
    );
    const count = await testPrisma.userRole.count({ where: { user_id: user.id } });
    expect(count).toBe(1);
  });
});
