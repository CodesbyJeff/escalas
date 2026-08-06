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

  it('idempotente sob concorrência: 5 chamadas paralelas resultam em 1 role', async () => {
    const { user, lotacao, admin } = await seedUserAndLotacao();
    const input = { user_id: user.id, role: 'ESCALANTE' as const, lotacao_id: lotacao.id };
    await Promise.all(
      Array.from({ length: 5 }, () => adminService.atribuirRole(input, admin.id, testPrisma)),
    );
    const count = await testPrisma.userRole.count({ where: { user_id: user.id } });
    expect(count).toBe(1);
  });
});

describe('admin.service.listarUsuarios', () => {
  // 105 militares numa lotação: acima do teto padrão de 100.
  async function seedLotacaoGrande(): Promise<number> {
    const lotacao = await testPrisma.lotacao.create({
      data: { id: 998, sigla: 'BIG', nome: 'Lotação Grande', nivel: 1, operacional: true },
    });
    for (let n = 0; n < 105; n++) {
      const u = await testPrisma.user.create({
        data: { cpf: `7000000${String(n).padStart(4, '0')}`, nome: `Militar ${String(n).padStart(3, '0')}`, last_sync_at: new Date() },
      });
      await testPrisma.userLotacao.create({ data: { user_id: u.id, lotacao_id: lotacao.id, nivel: 3 } });
    }
    return lotacao.id;
  }

  it('aplica o teto padrão de 100 nas listagens de tela', async () => {
    const lotacao_id = await seedLotacaoGrande();
    const list = await adminService.listarUsuarios({ lotacao_id }, testPrisma);
    expect(list).toHaveLength(100);
  });

  it('limite null devolve o efetivo inteiro (pool do motor de preenchimento)', async () => {
    const lotacao_id = await seedLotacaoGrande();
    const list = await adminService.listarUsuarios({ lotacao_id, limite: null }, testPrisma);
    expect(list).toHaveLength(105);
  });
});
