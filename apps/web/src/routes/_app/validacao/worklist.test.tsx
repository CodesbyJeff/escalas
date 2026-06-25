// apps/web/src/routes/_app/validacao/worklist.test.tsx
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { GestorWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista os dias aguardando validação', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/gestor`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { escala_id: 2, lotacao_id: 100, data: '2026-06-25', execucao_status: 'registrada', vagas_total: 5 },
    ] })));
  renderWithProviders(<GestorWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('2026-06-25')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /validar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/gestor`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<GestorWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhum dia aguardando validação/i)).toBeInTheDocument();
});
