import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { LoadingState } from './LoadingState';

it('anuncia carregamento ao leitor de tela', () => {
  renderWithProviders(<LoadingState />);
  expect(screen.getByRole('status')).toHaveAccessibleName('Carregando');
});

it('renderiza o número de linhas pedido', () => {
  const { container } = renderWithProviders(<LoadingState variant="table" linhas={3} />);
  expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(3);
});

it('a variante cards renderiza uma grade de esqueletos', () => {
  const { container } = renderWithProviders(<LoadingState variant="cards" linhas={4} />);
  expect(container.querySelectorAll('.mantine-Skeleton-root')).toHaveLength(4);
});
