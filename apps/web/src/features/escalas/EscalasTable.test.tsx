import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { EscalasTable } from './EscalasTable';

const escalas = [
  { id: 1, lotacao_id: 10, mes: 3, ano: 2026, status: 'rascunho' as const, criado_por_id: 1, publicado_em: null },
];

it('renderiza linhas de escala com mês/ano e status', () => {
  renderWithProviders(<EscalasTable escalas={escalas} onEditar={vi.fn()} onExcluir={vi.fn()} />);
  expect(screen.getByText('03/2026')).toBeInTheDocument();
  expect(screen.getByText(/rascunho/i)).toBeInTheDocument();
});

it('mostra estado vazio quando não há escalas', () => {
  renderWithProviders(<EscalasTable escalas={[]} onEditar={vi.fn()} onExcluir={vi.fn()} />);
  expect(screen.getByText(/nenhuma escala/i)).toBeInTheDocument();
});
