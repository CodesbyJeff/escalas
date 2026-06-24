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
  await waitFor(() => expect(screen.getAllByText(/conflito de turno/i).length).toBeGreaterThan(0));
});
