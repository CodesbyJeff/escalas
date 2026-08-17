import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { ErrorState } from './ErrorState';

it('mostra a mensagem de erro', () => {
  renderWithProviders(<ErrorState message="Falha ao carregar a escala." />);
  expect(screen.getByText('Falha ao carregar a escala.')).toBeInTheDocument();
});

it('chama onRetry ao clicar em Tentar novamente', async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();
  renderWithProviders(<ErrorState message="Falhou." onRetry={onRetry} />);
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it('omite o botão quando não há onRetry', () => {
  renderWithProviders(<ErrorState message="Falhou." />);
  expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
});
