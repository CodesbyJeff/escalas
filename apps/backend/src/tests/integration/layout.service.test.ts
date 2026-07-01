import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { layoutService } from '../../services/template.service.js';
import { ConflictError } from '../../utils/errors.js';

beforeEach(resetDb);

async function lotacaoEUser() {
  const lot = await testPrisma.lotacao.create({ data: { id: 900, sigla: 'L900', nome: 'L', nivel: 3, operacional: true } });
  const u = await testPrisma.user.create({ data: { cpf: '90000000001', nome: 'Esc', last_sync_at: new Date() } });
  return { lot, u };
}
const layoutInput = (nome: string) => ({ nome, guarnicoes: [
  { sigla: 'ABT', atividade: 'Incêndio', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
    vagas_sugeridas: [{ funcao: 'Comandante', quantidade_sugerida: 1 }, { funcao: 'Motorista', quantidade_sugerida: 2 }] },
] });

describe('layoutService', () => {
  it('cria e lista múltiplos layouts na mesma lotação', async () => {
    const { lot, u } = await lotacaoEUser();
    await layoutService.criar(lot.id, u.id, layoutInput('Dia Útil'), testPrisma);
    await layoutService.criar(lot.id, u.id, layoutInput('Fim de Semana'), testPrisma);
    const lista = await layoutService.listarPorLotacao(lot.id, testPrisma);
    expect(lista.map((l) => l.nome).sort()).toEqual(['Dia Útil', 'Fim de Semana']);
    expect(lista[0]!.qtd_guarnicoes).toBe(1);
  });

  it('nome duplicado na mesma lotação → ConflictError', async () => {
    const { lot, u } = await lotacaoEUser();
    await layoutService.criar(lot.id, u.id, layoutInput('Padrão'), testPrisma);
    await expect(layoutService.criar(lot.id, u.id, layoutInput('Padrão'), testPrisma)).rejects.toBeInstanceOf(ConflictError);
  });

  it('atualizar substitui guarnições; excluir remove', async () => {
    const { lot, u } = await lotacaoEUser();
    const l = await layoutService.criar(lot.id, u.id, layoutInput('X'), testPrisma);
    const upd = await layoutService.atualizar(l.id, u.id, { nome: 'X', guarnicoes: [
      { sigla: 'UR', atividade: 'APH', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: [{ funcao: 'Socorrista', quantidade_sugerida: 1 }] },
    ] }, testPrisma);
    expect(upd.guarnicoes).toHaveLength(1);
    expect(upd.guarnicoes[0]!.sigla).toBe('UR');
    await layoutService.excluir(l.id, testPrisma);
    expect(await layoutService.obter(l.id, testPrisma)).toBeNull();
  });
});
