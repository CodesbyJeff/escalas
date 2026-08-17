import { screen } from '@testing-library/react';
import { Button } from '@mantine/core';
import { renderWithProviders } from '../../test/render';
import { PageHeader } from './PageHeader';

it('renderiza o título como heading de nível 1 da página', () => {
  renderWithProviders(<PageHeader title="Lista de Escalas" />);
  expect(screen.getByRole('heading', { name: 'Lista de Escalas', level: 1 })).toBeInTheDocument();
});

it('mostra o subtítulo quando fornecido', () => {
  renderWithProviders(<PageHeader title="Escalas" subtitle="1º BBM — agosto de 2026" />);
  expect(screen.getByText('1º BBM — agosto de 2026')).toBeInTheDocument();
});

it('não renderiza subtítulo quando ausente', () => {
  const { container } = renderWithProviders(<PageHeader title="Escalas" />);
  expect(container.querySelectorAll('p')).toHaveLength(0);
});

it('posiciona as ações', () => {
  renderWithProviders(<PageHeader title="Escalas" actions={<Button>Nova</Button>} />);
  expect(screen.getByRole('button', { name: 'Nova' })).toBeInTheDocument();
});
