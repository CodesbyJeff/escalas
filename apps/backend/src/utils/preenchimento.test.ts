import { describe, expect, it } from 'vitest';
import { planejarPreenchimento, type PlanoInput } from './preenchimento.js';

const T24 = { turno_inicio: '08:00', turno_fim: '08:00' }; // 24h
function base(over: Partial<PlanoInput> = {}): PlanoInput {
  return {
    descanso_horas: 72,
    militares: [
      { id: 1, nome: 'A', patente_id: 17 },
      { id: 2, nome: 'B', patente_id: 12 },
    ],
    contagemInicial: new Map(),
    intervalosExistentes: [],
    vagas: [],
    esperadasPorFuncao: new Map(),
    ...over,
  };
}
const vaga = (vaga_id: number, data: string, funcao = 'OP') => ({ vaga_id, data, guarnicao_sigla: 'INC', guarnicao_ordem: 0, funcao, ...T24 });

describe('planejarPreenchimento', () => {
  it('equidade: quem tem menos serviços é escolhido primeiro', () => {
    const out = planejarPreenchimento(base({ contagemInicial: new Map([[1, 5]]), vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(2); // A tem 5, B tem 0
    expect(out[0]!.aviso_descanso).toBe(false);
  });

  it('conflito de turno no mesmo dia nunca ocorre (hard): a 2ª vaga do dia vai p/ o outro militar', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-01')] }));
    const ids = out.map((r) => r.militar_id);
    expect(new Set(ids).size).toBe(2); // dois militares distintos no mesmo dia/turno 24h
  });

  it('descanso: com 1 militar só, a 2ª vaga em 72h é preenchida com aviso_descanso', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      vagas: [vaga(10, '2026-08-01'), vaga(11, '2026-08-02')], // 08→08 no dia seguinte: começa logo após o fim
    }));
    expect(out[1]!.militar_id).toBe(1);
    expect(out[1]!.aviso_descanso).toBe(true);
  });

  it('patente: prioriza compatível, mas não bloqueia divergente', () => {
    const out = planejarPreenchimento(base({
      esperadasPorFuncao: new Map([['OP', [12]]]), // espera patente 12 → militar B
      vagas: [vaga(10, '2026-08-01', 'OP')],
    }));
    expect(out[0]!.militar_id).toBe(2);
    expect(out[0]!.aviso_patente).toBe(false);
  });

  it('vaga sem candidato sem conflito → militar_id null', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      intervalosExistentes: [{ militar_id: 1, data: '2026-08-01', ...T24 }], // A já ocupado 24h nesse dia
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBeNull();
  });

  it('determinístico: empate total de equidade → menor militar_id', () => {
    const out = planejarPreenchimento(base({ vagas: [vaga(10, '2026-08-01')] }));
    expect(out[0]!.militar_id).toBe(1);
  });

  it('intervalo de militar fora do pool é ignorado, não vira candidato nem trava a vaga', () => {
    const out = planejarPreenchimento(base({
      militares: [{ id: 1, nome: 'A', patente_id: 17 }],
      intervalosExistentes: [{ militar_id: 99, data: '2026-08-01', ...T24 }], // 99 não está no pool
      vagas: [vaga(10, '2026-08-01')],
    }));
    expect(out[0]!.militar_id).toBe(1);
  });
});
