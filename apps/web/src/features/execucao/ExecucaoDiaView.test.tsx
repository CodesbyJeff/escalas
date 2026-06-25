// apps/web/src/features/execucao/ExecucaoDiaView.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ExecucaoDiaView } from './ExecucaoDiaView';

const dia: any = {
  escala_id: 2, data: '2026-06-25', execucao_status: 'rejeitada', validado_em: null, justificativa: 'Corrigir o motorista',
  guarnicoes: [{
    id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
    vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
      execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }],
  }],
};

it('mostra o badge de status, a guarnição e o alerta de rejeição', () => {
  renderWithProviders(
    <ExecucaoDiaView escalaId={2} dia={dia} getMilitarNome={() => 'SD Filho'} mode="validar" />,
  );
  expect(screen.getAllByText(/rejeitada/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/ABT-01/)).toBeInTheDocument();
  expect(screen.getByText(/corrigir o motorista/i)).toBeInTheDocument();
  expect(screen.getByText(/comandante/i)).toBeInTheDocument();
});
