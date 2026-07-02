import { describe, it, expect } from 'vitest';
import type { EscalaDiaDTO } from '@escalas/shared-types';
import { contarVagasComAviso } from './avisosPatente';

function vaga(aviso: boolean) {
  return { id: 1, funcao: 'X', militar_id: 1, turno_inicio: '08:00', turno_fim: '08:00', observacoes: null, patentes_esperadas: [12], aviso_patente: aviso };
}
function dia(avisos: boolean[]): EscalaDiaDTO {
  return {
    id: 1, data: '2026-09-01', observacoes: null,
    guarnicoes: [
      { id: 1, sigla: 'A', atividade: 'X', viatura_id: null, turno_inicio: '08:00', turno_fim: '08:00', ordem: 0, vagas: avisos.map(vaga) },
    ],
  };
}

describe('contarVagasComAviso', () => {
  it('conta só as vagas com aviso_patente true', () => {
    expect(contarVagasComAviso(dia([true, false, true]))).toBe(2);
    expect(contarVagasComAviso(dia([false, false]))).toBe(0);
  });
});
