import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { ColorSchemeToggle } from './ColorSchemeToggle';

it('tem rótulo acessível e alterna ao clicar', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ColorSchemeToggle />);
  const botao = screen.getByRole('button', { name: /tema/i });
  const rotuloInicial = botao.getAttribute('aria-label');
  expect(rotuloInicial).toMatch(/mudar para tema (claro|escuro)/i);

  await user.click(botao);

  // O rótulo acessível reflete o próximo tema disponível: após alternar,
  // deve apontar para o tema oposto ao inicial — prova que o clique
  // realmente mudou o esquema, não só que não quebrou.
  const rotuloApos = botao.getAttribute('aria-label');
  expect(rotuloApos).not.toBe(rotuloInicial);
});
