import { renderHook, act } from '@testing-library/react';
import { useDiaDraft } from './useDiaDraft';

const dia = {
  id: 1, data: '2026-03-15', observacoes: null,
  guarnicoes: [{
    id: 5, sigla: 'SLV', atividade: 'Salvamento', viatura_id: null,
    turno_inicio: '08:00', turno_fim: '08:00', ordem: 0,
    vagas: [{ id: 9, funcao: 'Comandante', militar_id: 100, turno_inicio: '08:00', turno_fim: '08:00', observacoes: null }],
  }],
};

it('semeia o rascunho a partir do DTO (sem ids) e adiciona vaga VAGO', () => {
  const { result } = renderHook(() => useDiaDraft(dia));
  expect(result.current.values.guarnicoes[0]!.vagas[0]).not.toHaveProperty('id');
  expect(result.current.values.guarnicoes[0]!.vagas[0]!.militar_id).toBe(100);
  act(() => result.current.addVaga(0));
  expect(result.current.values.guarnicoes[0]!.vagas).toHaveLength(2);
  expect(result.current.values.guarnicoes[0]!.vagas[1]!.militar_id).toBeNull();
});

it('toPutInput devolve o payload do PUT', () => {
  const { result } = renderHook(() => useDiaDraft(dia));
  const payload = result.current.toPutInput();
  expect(payload.guarnicoes[0]!.sigla).toBe('SLV');
  expect(payload.guarnicoes[0]!.vagas[0]!.funcao).toBe('Comandante');
});
