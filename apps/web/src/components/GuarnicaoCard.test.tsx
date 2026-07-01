import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

it('mostra a sigla e marca vaga sem militar como DO', () => {
  renderWithProviders(
    <GuarnicaoCard escalaId={1} guarnicao={guarnicao} gi={0}
      onAddVaga={vi.fn()} onRemoveVaga={vi.fn()} onRemove={vi.fn()} getVagaProps={() => ({})} setMilitar={vi.fn()} />,
  );
  expect(screen.getByDisplayValue('SLV')).toBeInTheDocument();
  expect(screen.getByText('DO')).toBeInTheDocument();
});

it('chama onAddVaga ao clicar em "Adicionar Função / Militar"', async () => {
  const onAddVaga = vi.fn();
  renderWithProviders(
    <GuarnicaoCard escalaId={1} guarnicao={guarnicao} gi={2}
      onAddVaga={onAddVaga} onRemoveVaga={vi.fn()} onRemove={vi.fn()} getVagaProps={() => ({})} setMilitar={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /adicionar função/i }));
  expect(onAddVaga).toHaveBeenCalledWith(2);
});

it('chama onRemoveVaga com o índice correto ao remover uma vaga', async () => {
  const onRemoveVaga = vi.fn();
  renderWithProviders(
    <GuarnicaoCard escalaId={1} guarnicao={guarnicao} gi={0}
      onAddVaga={vi.fn()} onRemoveVaga={onRemoveVaga} onRemove={vi.fn()} getVagaProps={() => ({})} setMilitar={vi.fn()} />,
  );
  // guarnicao has 2 vagas; click the remove button of the second vaga (vi=1)
  const removeButtons = screen.getAllByRole('button', { name: /remover vaga/i });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  await userEvent.click(removeButtons[1]!);
  expect(onRemoveVaga).toHaveBeenCalledWith(0, 1);
});

it('chama onRemove ao clicar em "Remover guarnição"', async () => {
  const onRemove = vi.fn();
  renderWithProviders(
    <GuarnicaoCard escalaId={1} guarnicao={guarnicao} gi={3}
      onAddVaga={vi.fn()} onRemoveVaga={vi.fn()} onRemove={onRemove} getVagaProps={() => ({})} setMilitar={vi.fn()} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /remover guarnição/i }));
  expect(onRemove).toHaveBeenCalledWith(3);
});
