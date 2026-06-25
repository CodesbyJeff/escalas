import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { FiscalWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista os dias pendentes do fiscal', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/fiscal`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { escala_id: 2, lotacao_id: 100, data: '2026-06-25', execucao_status: 'pendente', vagas_total: 5 },
    ] })));
  renderWithProviders(<FiscalWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('2026-06-25')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /registrar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/execucoes/pendentes/fiscal`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<FiscalWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhum dia pendente de registro/i)).toBeInTheDocument();
});
