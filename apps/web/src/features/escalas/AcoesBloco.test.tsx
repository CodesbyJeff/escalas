import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { AcoesBloco } from './AcoesBloco';

const BASE = 'http://localhost:3000/api/v1';
const layouts = [{ id: 5, lotacao_id: 10, nome: 'Padrão', qtd_guarnicoes: 3 }];

function mockLayouts() {
  server.use(
    http.get(`${BASE}/templates/lotacao/10`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: layouts })),
  );
}

it('usa heading nível 2 para o título de seção (não pula nível sob o h1 da página)', () => {
  mockLayouts();
  renderWithProviders(<AcoesBloco escalaId={1} lotacaoId={10} ano={2026} mes={9} />);
  expect(screen.getByRole('heading', { level: 2, name: /ações de bloco/i })).toBeInTheDocument();
});

it('gera estrutura no intervalo, envia o payload correto e mostra dias afetados', async () => {
  mockLayouts();
  let capturedBody: unknown = null;
  server.use(
    http.post(`${BASE}/escalas/1/gerar-bloco`, async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json({ success: true, message: 'ok', data: { dias_afetados: 20 } });
    }),
  );
  renderWithProviders(<AcoesBloco escalaId={1} lotacaoId={10} ano={2026} mes={9} />);

  await userEvent.type(screen.getByLabelText(/data início/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/data fim/i), '2026-09-30');
  await userEvent.click(screen.getByRole('textbox', { name: /layout/i }));
  await userEvent.click(await screen.findByText('Padrão'));
  await userEvent.click(screen.getByRole('button', { name: /gerar estrutura/i }));

  await waitFor(() => expect(screen.getByText(/20 dias afetados/i)).toBeInTheDocument());
  expect(capturedBody).toEqual({ data_ini: '2026-09-01', data_fim: '2026-09-30', template_id: 5 });
});

it('repete o ciclo e mostra dias afetados', async () => {
  mockLayouts();
  server.use(
    http.post(`${BASE}/escalas/1/repetir-ciclo`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: { dias_afetados: 5 } })),
  );
  renderWithProviders(<AcoesBloco escalaId={1} lotacaoId={10} ano={2026} mes={9} />);

  await userEvent.type(screen.getByLabelText(/início do ciclo/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/fim do ciclo/i), '2026-09-07');
  await userEvent.type(screen.getByLabelText(/repetir até/i), '2026-09-30');
  await userEvent.click(screen.getByRole('button', { name: /repetir ciclo/i }));

  await waitFor(() => expect(screen.getByText(/5 dias afetados/i)).toBeInTheDocument());
});

it('mostra a mensagem de erro quando repetir ciclo retorna 422 por conflito', async () => {
  mockLayouts();
  server.use(
    http.post(`${BASE}/escalas/1/repetir-ciclo`, () =>
      HttpResponse.json(
        { success: false, message: 'Conflito de turno ao repetir no dia 2026-09-03.', data: null },
        { status: 422 },
      )),
  );
  renderWithProviders(<AcoesBloco escalaId={1} lotacaoId={10} ano={2026} mes={9} />);

  await userEvent.type(screen.getByLabelText(/início do ciclo/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/fim do ciclo/i), '2026-09-07');
  await userEvent.type(screen.getByLabelText(/repetir até/i), '2026-09-30');
  await userEvent.click(screen.getByRole('button', { name: /repetir ciclo/i }));

  await waitFor(() =>
    expect(screen.getByText(/conflito de turno ao repetir no dia 2026-09-03/i)).toBeInTheDocument(),
  );
});
