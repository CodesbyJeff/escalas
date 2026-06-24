import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { GuarnicaoCard } from './GuarnicaoCard';

const guarnicao = {
  sigla: 'SLV', atividade: 'Salvamento', viatura_id: null,
  turno_inicio: '08:00', turno_fim: '08:00', ordem: 0,
  vagas: [
    { funcao: 'Comandante', militar_id: 100, turno_inicio: '08:00', turno_fim: '08:00' },
    { funcao: 'Operador', militar_id: null, turno_inicio: '08:00', turno_fim: '08:00' },
  ],
};

it('mostra a sigla e marca vaga sem militar como VAGO', () => {
  renderWithProviders(
    <GuarnicaoCard escalaId={1} guarnicao={guarnicao} gi={0}
      onAddVaga={vi.fn()} onRemoveVaga={vi.fn()} onRemove={vi.fn()} getVagaProps={() => ({})} setMilitar={vi.fn()} />,
  );
  expect(screen.getByDisplayValue('SLV')).toBeInTheDocument();
  expect(screen.getByText('VAGO')).toBeInTheDocument();
});
