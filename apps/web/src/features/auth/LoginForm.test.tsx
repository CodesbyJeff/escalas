import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { LoginForm } from './LoginForm';

it('chama onSubmit com cpf e senha válidos', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<LoginForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText(/usuário/i), '00000000000');
  await userEvent.type(screen.getByLabelText(/senha/i), 'segredo');
  await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ cpf: '00000000000', senha: 'segredo' }));
});

it('exibe erro de validação para CPF inválido', async () => {
  renderWithProviders(<LoginForm onSubmit={vi.fn()} />);
  await userEvent.type(screen.getByLabelText(/usuário/i), '123');
  await userEvent.type(screen.getByLabelText(/senha/i), 'x');
  await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
  expect(await screen.findByText(/11 dígitos/i)).toBeInTheDocument();
});
