import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { EditorDia } from './$id.dias.$data';

const BASE = 'http://localhost:3000/api/v1';
const dia = { id: 1, data: '2026-03-15', observacoes: null, guarnicoes: [] };

it('salva o dia e mostra notificação de sucesso', async () => {
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(screen.getByText(/dia salvo/i)).toBeInTheDocument());
});

it('exibe aviso de conflito no 422', async () => {
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () =>
      HttpResponse.json({ success: false, message: 'Conflito de turno.', data: null }, { status: 422 })),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
  // Assert the Mantine Alert (inline conflict warning) is present with the specific conflict text
  await waitFor(() => {
    const alerts = screen.getAllByRole('alert');
    const conflictAlert = alerts.find(el => el.textContent && /conflito de turno/i.test(el.textContent));
    if (!conflictAlert) throw new Error('Conflict alert not found');
    expect(conflictAlert).toHaveTextContent(/conflito de turno/i);
  });
});

it('clica em Publicar e mostra notificação de sucesso', async () => {
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.post(`${BASE}/escalas/1/publicar`, () => HttpResponse.json({ success: true, message: 'ok', data: null })),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  await userEvent.click(screen.getByRole('button', { name: /publicar/i }));
  await waitFor(() => expect(screen.getByText(/escala publicada/i)).toBeInTheDocument());
});

it('exibe mensagem de recarga ao salvar com conflito de versão (409)', async () => {
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () =>
      HttpResponse.json({ success: false, message: 'Conflito de versão.', data: null }, { status: 409 })),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(screen.getByText(/a escala mudou\. recarregue\./i)).toBeInTheDocument());
});

it('salvar invalida cache: re-fetches dia após sucesso', async () => {
  let getCalls = 0;
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => {
      getCalls++;
      return HttpResponse.json({ success: true, message: 'ok', data: dia });
    }),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  const getsBefore = getCalls;
  await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(getCalls).toBeGreaterThan(getsBefore));
});

it('não chama PUT quando draft está inválido (campos obrigatórios)', async () => {
  const diaInvalido = {
    id: 2, data: '2026-03-15', observacoes: null,
    guarnicoes: [{
      id: 10, sigla: '', atividade: '', viatura_id: null,
      turno_inicio: '08:00', turno_fim: '17:00', ordem: 0, vagas: [],
    }],
  };
  let putCalled = false;
  server.use(
    http.get(`${BASE}/escalas/1/dias/2026-03-15`, () => HttpResponse.json({ success: true, message: 'ok', data: diaInvalido })),
    http.put(`${BASE}/escalas/1/dias/2026-03-15`, () => { putCalled = true; return HttpResponse.json({ success: true, message: 'ok', data: diaInvalido }); }),
  );
  renderWithProviders(<EditorDia escalaId={1} data="2026-03-15" />);
  await screen.findByText(/quadro de escala/i);
  await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => expect(screen.getByText(/campos obrigatórios/i)).toBeInTheDocument());
  expect(putCalled).toBe(false);
});
