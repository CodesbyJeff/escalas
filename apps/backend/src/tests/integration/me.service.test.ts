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

  async function escalaComVaga(status: 'publicada' | 'rascunho' | 'em_validacao' | 'aprovada' | 'rejeitada', dataISO: string, militarId: number | null) {
    const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: Number(dataISO.slice(5, 7)), ano: Number(dataISO.slice(0, 4)), status, criado_por_id: militar.id, publicado_em: new Date() } });
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

  it('inclui publicada/em_validacao/aprovada e exclui rascunho/rejeitada (mesma data)', async () => {
    const militar = await testPrisma.user.create({ data: { cpf: '82000000001', nome: 'M Status', last_sync_at: new Date() } });
    // uma escala por status, cada uma em sua lotação (evita o unique [lotacao_id, mes, ano]), todas no mesmo dia
    const statuses = [
      { id: 821, status: 'publicada', vem: true },
      { id: 822, status: 'em_validacao', vem: true },
      { id: 823, status: 'aprovada', vem: true },
      { id: 824, status: 'rascunho', vem: false },
      { id: 825, status: 'rejeitada', vem: false },
    ] as const;
    for (const s of statuses) {
      const lot = await testPrisma.lotacao.create({ data: { id: s.id, sigla: `S${s.id}`, nome: `Lot ${s.id}`, nivel: 3, operacional: true } });
      const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 7, ano: 2026, status: s.status, criado_por_id: militar.id, publicado_em: new Date() } });
      const dia = await testPrisma.escalaDia.create({ data: { escala_id: esc.id, data: D('2026-07-20') } });
      const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
      await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' } });
    }
    const r = await meService.listarMeusServicos(militar.id, D('2026-07-01'), D('2026-07-31'), testPrisma);
    const siglas = r.map((s) => s.lotacao.sigla).sort();
    expect(siglas).toEqual(['S821', 'S822', 'S823']); // publicada, em_validacao, aprovada
  });
});
