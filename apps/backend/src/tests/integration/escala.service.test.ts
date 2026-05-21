import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { escalaService } from '../../services/escala.service.js';

async function seedLotacao(id = 800) {
  return testPrisma.lotacao.create({
    data: { id, sigla: `L${id}`, nome: 'Lot', nivel: 3, operacional: true },
  });
}
async function seedUser(cpf: string) {
  return testPrisma.user.create({ data: { cpf, nome: 'U', last_sync_at: new Date() } });
}
async function seedTemplate(lotacao_id: number, criado_por_id: number) {
  return testPrisma.templateLotacao.create({
    data: {
      lotacao_id,
      criado_por_id,
      guarnicoes: {
        create: [{
          sigla: 'ABT-01', atividade: 'incendio',
          turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
          vagas_sugeridas: { create: [
            { funcao: 'comandante', quantidade_sugerida: 1 },
            { funcao: 'motorista', quantidade_sugerida: 2 },
          ] },
        }],
      },
    },
  });
}

describe('escalaService.criar', () => {
  it('gera dias do mês × template com vagas vazias', async () => {
    const lot = await seedLotacao();
    const user = await seedUser('20202020202');
    await seedTemplate(lot.id, user.id);

    const escala = await escalaService.criar(
      { lotacao_id: lot.id, mes: 4, ano: 2026 },
      user.id,
      testPrisma,
    );

    expect(escala.status).toBe('rascunho');
    const dias = await testPrisma.escalaDia.count({ where: { escala_id: escala.id } });
    expect(dias).toBe(30); // abril
    const guarnicoes = await testPrisma.escalaGuarnicao.count();
    expect(guarnicoes).toBe(30);
    const vagas = await testPrisma.vaga.count();
    expect(vagas).toBe(90); // (1 comandante + 2 motorista) × 30 dias
    const umaVaga = await testPrisma.vaga.findFirst();
    expect(umaVaga!.militar_id).toBeNull();
    expect(umaVaga!.turno_inicio).toBe('07:00');
  });

  it('bloqueia (409) se lotação não tem template', async () => {
    const lot = await seedLotacao(801);
    const user = await seedUser('30303030303');
    await expect(
      escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('bloqueia (409) escala duplicada no mesmo mês/ano', async () => {
    const lot = await seedLotacao(802);
    const user = await seedUser('40404040404');
    await seedTemplate(lot.id, user.id);
    await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    await expect(
      escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('registra AuditLog de criação', async () => {
    const lot = await seedLotacao(803);
    const user = await seedUser('50505050505');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    const logs = await testPrisma.auditLog.findMany({ where: { entidade: 'Escala', entidade_id: escala.id, acao: 'criar' } });
    expect(logs).toHaveLength(1);
  });
});
