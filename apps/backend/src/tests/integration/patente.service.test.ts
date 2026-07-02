import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { patenteService } from '../../services/patente.service.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 900, sigla: 'L900', nome: 'L', nivel: 3, operacional: true } });
  const admin = await testPrisma.user.create({ data: { cpf: 'ADM900', nome: 'Adm', last_sync_at: new Date() } });
  const tpl = await testPrisma.templateLotacao.create({ data: { lotacao_id: lot.id, nome: 'P', criado_por_id: admin.id } });
  return { lot, tpl };
}

describe('patenteService.esperadasPara (cascata)', () => {
  beforeEach(async () => { await resetDb(); });

  it('sem regra em nenhuma camada → null', async () => {
    const { lot, tpl } = await cenario();
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toBeNull();
  });

  it('global aplica quando não há lotação/layout', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12, 13] } });
    expect(await patenteService.esperadasPara('comandante', lot.id, tpl.id, testPrisma)).toEqual([12, 13]);
  });

  it('lotação vence global', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    await testPrisma.funcaoPatente.create({ data: { lotacao_id: lot.id, funcao_norm: 'COMANDANTE', patente_ids: [4, 5] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toEqual([4, 5]);
  });

  it('layout vence lotação e global', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    await testPrisma.funcaoPatente.create({ data: { lotacao_id: lot.id, funcao_norm: 'COMANDANTE', patente_ids: [4, 5] } });
    await testPrisma.funcaoPatente.create({ data: { template_id: tpl.id, funcao_norm: 'COMANDANTE', patente_ids: [4] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toEqual([4]);
  });

  it('camada com patente_ids vazio VENCE e não cai para a de baixo (silencia)', async () => {
    const { lot, tpl } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    await testPrisma.funcaoPatente.create({ data: { lotacao_id: lot.id, funcao_norm: 'COMANDANTE', patente_ids: [] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, tpl.id, testPrisma)).toEqual([]);
  });

  it('template_id null ignora a camada layout', async () => {
    const { lot } = await cenario();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });
    expect(await patenteService.esperadasPara('Comandante', lot.id, null, testPrisma)).toEqual([12]);
  });

  it('divergente: null quando não há regra; false quando bate; true quando não bate ou sem patente', () => {
    expect(patenteService.patenteDivergente(12, null)).toBe(false);
    expect(patenteService.patenteDivergente(12, [])).toBe(false);
    expect(patenteService.patenteDivergente(12, [12, 13])).toBe(false);
    expect(patenteService.patenteDivergente(99, [12, 13])).toBe(true);
    expect(patenteService.patenteDivergente(null, [12, 13])).toBe(true);
  });
});
