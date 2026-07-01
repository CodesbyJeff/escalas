import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { NovaEscalaForm } from './NovaEscalaForm';

const BASE = 'http://localhost:3000/api/v1';
const lotacoes = [{ value: '10', label: '1ºSBG/1ºGBM (NATAL)' }];

it('submete com template_id quando layout é escolhido', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/10`, () =>
      HttpResponse.json({
        success: true,
        message: 'ok',
        data: [{ id: 5, lotacao_id: 10, nome: 'Padrão', qtd_guarnicoes: 3 }],
      }),
    ),
  );

  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<NovaEscalaForm lotacoes={lotacoes} onSubmit={onSubmit} />);

  // Escolhe lotação
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  await userEvent.click(await screen.findByText('1ºSBG/1ºGBM (NATAL)'));

  // Aguarda layouts aparecerem e escolhe
  await userEvent.click(await screen.findByRole('textbox', { name: /layout/i }));
  await userEvent.click(await screen.findByText('Padrão'));

  await userEvent.click(screen.getByRole('button', { name: /gerar escala/i }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ lotacao_id: 10, template_id: 5 }),
      expect.anything(),
    ),
  );
});

it('não submete sem layout escolhido', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/10`, () =>
      HttpResponse.json({
        success: true,
        message: 'ok',
        data: [{ id: 5, lotacao_id: 10, nome: 'Padrão', qtd_guarnicoes: 3 }],
      }),
    ),
  );

  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<NovaEscalaForm lotacoes={lotacoes} onSubmit={onSubmit} />);

  // Escolhe lotação mas não escolhe layout
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  await userEvent.click(await screen.findByText('1ºSBG/1ºGBM (NATAL)'));

  // Aguarda layouts aparecerem (para ter certeza que o Select de layout está visível)
  await screen.findByRole('textbox', { name: /layout/i });

  await userEvent.click(screen.getByRole('button', { name: /gerar escala/i }));
  await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
});

it('mostra aviso e desabilita Select de layout quando não há layouts para a lotação', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/10`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: [] }),
    ),
  );

  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithProviders(<NovaEscalaForm lotacoes={lotacoes} onSubmit={onSubmit} />);

  // Escolhe lotação
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  await userEvent.click(await screen.findByText('1ºSBG/1ºGBM (NATAL)'));

  // Aguarda o select de layout aparecer desabilitado com mensagem de aviso
  const layoutInput = await screen.findByRole('textbox', { name: /layout/i });
  await waitFor(() => expect(layoutInput).toBeDisabled());
  expect(screen.getByText(/crie um layout/i)).toBeInTheDocument();
});
