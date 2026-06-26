// apps/web/src/features/aprovacao/ResumoServicosTable.test.tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { ResumoServicosTable } from './ResumoServicosTable';

const itens: any[] = [
  { militar_id: 1, nome: 'Alfa', posto: 'SD', total: 5, semana: 2, fim_semana_feriado: 3 },
  { militar_id: 2, nome: 'Bravo', posto: 'CB', total: 1, semana: 1, fim_semana_feriado: 0 },
];

it('mostra uma linha por militar e o total geral', () => {
  renderWithProviders(<ResumoServicosTable itens={itens} />);
  expect(screen.getByText('SD Alfa')).toBeInTheDocument();
  expect(screen.getByText('CB Bravo')).toBeInTheDocument();
  // total geral de serviços = 6
  expect(screen.getByText('Total: 6')).toBeInTheDocument();
});

it('estado vazio', () => {
  renderWithProviders(<ResumoServicosTable itens={[]} />);
  expect(screen.getByText(/nenhum militar/i)).toBeInTheDocument();
});
