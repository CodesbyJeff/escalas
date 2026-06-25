// apps/web/src/features/execucao/StatusExecucaoBadge.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatusExecucaoBadge } from './StatusExecucaoBadge';

it('mostra o rótulo de cada status', () => {
  const { rerender } = renderWithProviders(<StatusExecucaoBadge status="registrada" />);
  expect(screen.getByText(/aguardando validação/i)).toBeInTheDocument();
  rerender(<StatusExecucaoBadge status="validada" />);
  expect(screen.getByText(/^validada$/i)).toBeInTheDocument();
});
