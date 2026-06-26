// apps/web/src/routes/_app/aprovacao/worklist.test.tsx
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { AprovacaoWorklist } from './index';

const BASE = 'http://localhost:3000/api/v1';

it('lista escalas em validação', async () => {
  server.use(http.get(`${BASE}/validacoes/pendentes`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { id: 7, lotacao_id: 100, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: 1, publicado_em: null },
    ] })));
  renderWithProviders(<AprovacaoWorklist onAbrir={() => {}} />);
  expect(await screen.findByText('09/2026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /revisar/i })).toBeInTheDocument();
});

it('estado vazio', async () => {
  server.use(http.get(`${BASE}/validacoes/pendentes`, () => HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(<AprovacaoWorklist onAbrir={() => {}} />);
  expect(await screen.findByText(/nenhuma escala aguardando aprovação/i)).toBeInTheDocument();
});
