import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { PainelView } from './PainelView';

it('saúda o usuário e lista guarnições do dia', () => {
  const dia = { id: 1, data: '2026-03-28', observacoes: null, guarnicoes: [
    { id: 5, sigla: 'INC', atividade: 'Incêndio', viatura_id: null, turno_inicio: '08:00', turno_fim: '08:00', ordem: 0, vagas: [] },
  ] };
  renderWithProviders(<PainelView nome="ST Paiva" dia={dia} getMilitarNome={() => 'VAGO'} />);
  expect(screen.getByText(/seja bem vindo/i)).toBeInTheDocument();
  expect(screen.getByText('Incêndio')).toBeInTheDocument();
});

it('exibe o nome do militar na vaga preenchida', () => {
  const dia = { id: 2, data: '2026-03-28', observacoes: null, guarnicoes: [
    { id: 6, sigla: 'INC', atividade: 'Incêndio', viatura_id: null, turno_inicio: '08:00', turno_fim: '17:00', ordem: 0,
      vagas: [{ id: 20, funcao: 'CB', militar_id: 7, turno_inicio: '08:00', turno_fim: '17:00', observacoes: null }] },
  ] };
  renderWithProviders(
    <PainelView
      nome="ST Paiva"
      dia={dia}
      getMilitarNome={(id) => id === 7 ? 'SD Fulano' : 'VAGO'}
    />
  );
  expect(screen.getByText(/SD Fulano/i)).toBeInTheDocument();
});
