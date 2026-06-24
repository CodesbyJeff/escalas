import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { AppShellNav } from './AppShell';

it('mostra os itens de navegação do escalante', () => {
  renderWithProviders(<AppShellNav nome="ST Paiva" papel="Escalante" onLogout={vi.fn()} />);
  expect(screen.getByText('Painel')).toBeInTheDocument();
  expect(screen.getByText('Escala')).toBeInTheDocument();
  expect(screen.getByText('ST Paiva')).toBeInTheDocument();
});
