import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { NovaEscalaForm } from './NovaEscalaForm';

const lotacoes = [{ value: '10', label: '1ºSBG/1ºGBM (NATAL)' }];

it('submete mês, ano e lotação', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<NovaEscalaForm lotacoes={lotacoes} onSubmit={onSubmit} />);
  // Mantine Select renders a textbox input; use getByRole to avoid ambiguity with the listbox
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  await userEvent.click(await screen.findByText('1ºSBG/1ºGBM (NATAL)'));
  // mês/ano: usa NumberInput/Select já preenchidos com defaults do mês atual
  await userEvent.click(screen.getByRole('button', { name: /gerar escala/i }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ lotacao_id: 10 }),
      expect.anything(), // Mantine form.onSubmit passes (values, event)
    ),
  );
});
