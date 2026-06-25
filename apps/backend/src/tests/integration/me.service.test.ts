// apps/backend/src/tests/integration/me.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { meService } from '../../services/me.service.js';

beforeEach(resetDb);

// militar com 1 vaga em escala publicada (dia 2026-07-10) + 1 vaga em rascunho (não deve vir)
async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 800, sigla: 'L800', nome: 'Lot 800', nivel: 3, operacional: true } });
  const militar = await testPrisma.user.create({ data: { cpf: '80000000001', nome: 'Militar Teste', last_sync_at: new Date() } });
  const outro = await testPrisma.user.create({ data: { cpf: '80000000002', nome: 'Outro', last_sync_at: new Date() } });

  async function escalaComVaga(status: string, dataISO: string, militarId: number | null) {
    const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: Number(dataISO.slice(5, 7)), ano: Number(dataISO.slice(0, 4)), status, criado_por_id: militar.id, publicado_em: new Date() } as any });
    const dia = await testPrisma.escalaDia.create({ data: { escala_id: esc.id, data: new Date(`${dataISO}T00:00:00.000Z`) } });
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Motorista', militar_id: militarId, turno_inicio: '07:00', turno_fim: '19:00' } });
    return esc;
  }

  await escalaComVaga('publicada', '2026-07-10', militar.id);   // deve vir
  await escalaComVaga('rascunho', '2026-08-10', militar.id);    // NÃO (rascunho) — mês diferente p/ não colidir unique
  await escalaComVaga('publicada', '2026-09-10', outro.id);     // NÃO (outro militar)
  return { militar, outro, lot };
}

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('meService.listarMeusServicos', () => {
  it('retorna só as vagas do militar em escalas publicadas, dentro da faixa', async () => {
    const { militar } = await cenario();
    const r = await meService.listarMeusServicos(militar.id, D('2026-07-01'), D('2026-12-31'), testPrisma);
    expect(r).toHaveLength(1);
    expect(r[0]!.data).toBe('2026-07-10');
    expect(r[0]!.funcao).toBe('Motorista');
    expect(r[0]!.guarnicao.sigla).toBe('ABT-01');
    expect(r[0]!.lotacao.sigla).toBe('L800');
  });

  it('exclui dias fora da faixa de datas', async () => {
    const { militar } = await cenario();
    const r = await meService.listarMeusServicos(militar.id, D('2026-08-01'), D('2026-08-31'), testPrisma);
    expect(r).toHaveLength(0);
  });
});
