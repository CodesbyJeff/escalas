import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';

async function ctx() {
  const lot = await testPrisma.lotacao.create({ data: { id: 950, sigla: 'L950', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM950', nome: 'Adm', last_sync_at: new Date() } });
  return { lot, admin };
}
const guarn = (funcao: string, patentes?: number[]) => ({
  sigla: 'INC', atividade: 'INCENDIO', turno_padrao_inicio: '08:00', turno_padrao_fim: '08:00', ordem: 0,
  vagas_sugeridas: [{ funcao, quantidade_sugerida: 1, ...(patentes ? { patentes_esperadas: patentes } : {}) }],
});

describe('layoutService — camada patentes', () => {
  beforeEach(async () => { await resetDb(); });

  it('criar sincroniza FuncaoPatente(template_id) para funções com patentes', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12, 13])] }, testPrisma);
    const regras = await testPrisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
    expect(regras).toHaveLength(1);
    expect(regras[0]!).toMatchObject({ funcao_norm: 'COMANDANTE', patente_ids: [12, 13] });
  });

  it('função sem patentes não cria regra', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Motorista')] }, testPrisma);
    expect(await testPrisma.funcaoPatente.count({ where: { template_id: tpl.id } })).toBe(0);
  });

  it('atualizar faz replace-all das regras do layout', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12])] }, testPrisma);
    await layoutService.atualizar(tpl.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [4])] }, testPrisma);
    const regras = await testPrisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
    expect(regras).toHaveLength(1);
    expect(regras[0]!.patente_ids).toEqual([4]);
  });

  it('obter devolve patentes_esperadas por vaga (e [] quando sem regra)', async () => {
    const { lot, admin } = await ctx();
    const tpl = await layoutService.criar(lot.id, admin.id, { nome: 'P', guarnicoes: [guarn('Comandante', [12])] }, testPrisma);
    const obtido = await layoutService.obter(tpl.id, testPrisma);
    const vaga = obtido!.guarnicoes[0]!.vagas_sugeridas[0]! as unknown as { patentes_esperadas: number[] };
    expect(vaga.patentes_esperadas).toEqual([12]);
  });
});
