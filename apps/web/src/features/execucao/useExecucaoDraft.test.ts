// apps/web/src/features/execucao/useExecucaoDraft.test.ts
import { renderHook, act } from '@testing-library/react';
import { useExecucaoDraft } from './useExecucaoDraft';

const dia: any = {
  escala_id: 2, data: '2026-06-25', execucao_status: 'pendente', validado_em: null, justificativa: null,
  guarnicoes: [{
    id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
    vagas: [
      { id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null },
      { id: 11, funcao: 'Motorista', militar_id: 5, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 11, situacao: 'substituido', militar_executado_id: 9, do: true, observacoes: 'troca' } },
    ],
  }],
};

it('semeia presente por padrão e preserva execução existente', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  expect(result.current.getVaga(10)!.situacao).toBe('presente');
  expect(result.current.getVaga(10)!.militar_executado_id).toBeNull();
  expect(result.current.getVaga(11)!.situacao).toBe('substituido');
  expect(result.current.getVaga(11)!.militar_executado_id).toBe(9);
  expect(result.current.getVaga(11)!.do).toBe(true);
});

it('mudar para falta zera o substituto', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  act(() => result.current.setVaga(11, { situacao: 'falta' }));
  expect(result.current.getVaga(11)!.situacao).toBe('falta');
  expect(result.current.getVaga(11)!.militar_executado_id).toBeNull();
});

it('toPutInput devolve uma entrada por vaga com observacoes opcional', () => {
  const { result } = renderHook(() => useExecucaoDraft(dia));
  const input = result.current.toPutInput();
  expect(input.vagas).toHaveLength(2);
  const v10 = input.vagas.find((v) => v.vaga_id === 10)!;
  expect(v10.situacao).toBe('presente');
  expect(v10.observacoes).toBeUndefined();
  const v11 = input.vagas.find((v) => v.vaga_id === 11)!;
  expect(v11.observacoes).toBe('troca');
});
