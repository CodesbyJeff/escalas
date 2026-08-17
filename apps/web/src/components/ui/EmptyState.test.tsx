import { screen } from '@testing-library/react';
import { Button } from '@mantine/core';
import { renderWithProviders } from '../../test/render';
import { EmptyState } from './EmptyState';

// As strings de cópia atuais são preservadas: 33 arquivos de teste consultam por texto.
it('mostra o título do estado vazio', () => {
  renderWithProviders(<EmptyState title="Sem guarnições para hoje." />);
  expect(screen.getByText('Sem guarnições para hoje.')).toBeInTheDocument();
});

it('mostra descrição e ação quando fornecidas', () => {
  renderWithProviders(
    <EmptyState
      title="Nenhuma escala"
      description="Crie a primeira escala do mês."
      action={<Button>Nova Escala</Button>}
    />,
  );
  expect(screen.getByText('Crie a primeira escala do mês.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nova Escala' })).toBeInTheDocument();
});

it('o ícone é decorativo e fica escondido do leitor de tela', () => {
  const { container } = renderWithProviders(<EmptyState title="Vazio" />);
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});
