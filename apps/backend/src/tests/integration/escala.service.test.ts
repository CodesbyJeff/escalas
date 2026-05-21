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

describe('escalaService.listar / getDetalhe / getMes', () => {
  async function escalaPronta(lotId: number, cpf: string) {
    const lot = await seedLotacao(lotId);
    const user = await seedUser(cpf);
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    return { lot, user, escala };
  }

  it('listar filtra por lotacao_id e status', async () => {
    const { lot } = await escalaPronta(810, '11111111111');
    const lista = await escalaService.listar({ lotacao_id: lot.id, status: 'rascunho' }, testPrisma);
    expect(lista).toHaveLength(1);
    const vazia = await escalaService.listar({ lotacao_id: lot.id, status: 'aprovada' }, testPrisma);
    expect(vazia).toHaveLength(0);
  });

  it('getDetalhe traz dias com guarnições e vagas', async () => {
    const { escala } = await escalaPronta(811, '22222222222');
    const det = await escalaService.getDetalhe(escala.id, testPrisma);
    expect(det!.dias).toHaveLength(30);
    expect(det!.dias[0]!.guarnicoes[0]!.vagas).toHaveLength(3);
  });

  it('getDetalhe retorna null se não existe', async () => {
    expect(await escalaService.getDetalhe(999999, testPrisma)).toBeNull();
  });

  it('getMes resume status por dia', async () => {
    const { escala } = await escalaPronta(812, '33333333333');
    const mes = await escalaService.getMes(escala.id, testPrisma);
    expect(mes!.dias).toHaveLength(30);
    expect(mes!.dias[0]).toMatchObject({ vagas_total: 3, vagas_preenchidas: 0 });
  });
});
