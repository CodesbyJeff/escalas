import { describe, it, expect } from 'vitest';
import { guarnicoesCreateDoTemplate, diasNoIntervalo } from '../../utils/estruturaTemplate.js';

describe('estruturaTemplate', () => {
  it('expande vagas sugeridas por quantidade, com turno da guarnição', () => {
    const r = guarnicoesCreateDoTemplate([{ sigla: 'INC', atividade: 'INCENDIO', turno_padrao_inicio: '08:00', turno_padrao_fim: '08:00', ordem: 0, vagas_sugeridas: [{ funcao: 'CMT_GU', quantidade_sugerida: 1 }, { funcao: 'OP', quantidade_sugerida: 2 }] }]);
    expect(r[0]!.vagas.create).toHaveLength(3);
    expect(r[0]!.vagas.create[0]).toMatchObject({ funcao: 'CMT_GU', turno_inicio: '08:00', turno_fim: '08:00' });
  });
  it('diasNoIntervalo inclui as pontas', () => {
    const d = diasNoIntervalo('2026-09-01', '2026-09-04');
    expect(d.map((x) => x.toISOString().slice(0, 10))).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']);
  });
});
