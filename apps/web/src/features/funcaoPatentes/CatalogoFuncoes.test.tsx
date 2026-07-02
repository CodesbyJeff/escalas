import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { CatalogoFuncoes } from './CatalogoFuncoes';

const BASE = 'http://localhost:3000/api/v1';

const PATENTES = [
  { id: 1, forca_id: 1, sigla: 'CEL', nome: 'Coronel', ordem: 1 },
  { id: 2, forca_id: 1, sigla: 'TEN', nome: 'Tenente', ordem: 2 },
];

const LOTACOES = [{ id: 100, sigla: '1BBM', nome: 'Primeiro Batalhão' }];

function mockBase() {
  server.use(
    http.get(`${BASE}/patentes`, () => HttpResponse.json({ success: true, message: 'ok', data: PATENTES })),
    http.get(`${BASE}/admin/lotacoes`, () => HttpResponse.json({ success: true, message: 'ok', data: LOTACOES })),
    http.get(`${BASE}/funcao-patentes`, () => HttpResponse.json({ success: true, message: 'ok', data: [] })),
  );
}

it('cria uma regra global preenchendo a função e selecionando uma patente', async () => {
  mockBase();
  let capturedBody: unknown = null;
  server.use(
    http.post(`${BASE}/funcao-patentes`, async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json(
        {
          success: true,
          message: 'Regra criada.',
          data: { id: 1, lotacao_id: null, template_id: null, funcao_norm: 'comandante', patente_ids: [1] },
        },
        { status: 201 },
      );
    }),
  );

  renderWithProviders(<CatalogoFuncoes />);

  expect(await screen.findByText(/nenhuma regra cadastrada/i)).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('Função'), 'Comandante');

  await userEvent.click(screen.getByRole('textbox', { name: /patentes elegíveis/i }));
  const option = await screen.findByText('CEL — Coronel');
  await userEvent.click(option);

  await userEvent.click(screen.getByRole('button', { name: /adicionar regra/i }));

  await waitFor(() => expect(capturedBody).not.toBeNull());
  expect(capturedBody).toEqual({ lotacao_id: null, funcao: 'Comandante', patente_ids: [1] });
});
