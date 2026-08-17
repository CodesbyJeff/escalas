import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatusBadge } from './StatusBadge';

it('mostra o rótulo em caixa mista', () => {
  renderWithProviders(<StatusBadge status="em_validacao" />);
  expect(screen.getByText('Em validação')).toBeInTheDocument();
});

it('cobre os cinco estados de escala', () => {
  const estados = ['rascunho', 'publicada', 'em_validacao', 'aprovada', 'rejeitada'] as const;
  const rotulos = ['Rascunho', 'Publicada', 'Em validação', 'Aprovada', 'Rejeitada'];
  estados.forEach((e, i) => {
    const { unmount } = renderWithProviders(<StatusBadge status={e} />);
    expect(screen.getByText(rotulos[i])).toBeInTheDocument();
    unmount();
  });
});
