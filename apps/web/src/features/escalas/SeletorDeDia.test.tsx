import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { SeletorDeDia } from './SeletorDeDia';

it('chama onSelecionar com a data ISO do dia clicado', async () => {
  const onSelecionar = vi.fn();
  renderWithProviders(<SeletorDeDia mes={3} ano={2026} onSelecionar={onSelecionar} />);
  await userEvent.click(screen.getByText('15'));
  expect(onSelecionar).toHaveBeenCalledWith('2026-03-15');
});
