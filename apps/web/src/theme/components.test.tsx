import { screen } from '@testing-library/react';
import { Badge, Card } from '@mantine/core';
import { renderWithProviders } from '../test/render';

describe('defaults de componente', () => {
  // O Mantine força caixa-alta no label do Badge. "EM VALIDAÇÃO" é
  // mensuravelmente mais difícil de ler que "Em validação", e há badge de
  // status em quase toda tela do sistema.
  it('Badge não usa caixa-alta', () => {
    renderWithProviders(<Badge>Em validação</Badge>);
    const label = screen.getByText('Em validação');
    expect(getComputedStyle(label).textTransform).toBe('none');
  });

  it('Card nasce com borda', () => {
    const { container } = renderWithProviders(<Card>conteúdo</Card>);
    expect(container.querySelector('[data-with-border]')).not.toBeNull();
  });
});
