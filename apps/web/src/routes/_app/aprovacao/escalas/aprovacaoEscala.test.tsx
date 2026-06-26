// apps/web/src/routes/_app/aprovacao/escalas/aprovacaoEscala.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { AprovacaoEscalaScreen } from './$id';

const BASE = 'http://localhost:3000/api/v1';
function mockBase() {
  server.use(
    http.get(`${BASE}/escalas/7/mes`, () => HttpResponse.json({ success: true, message: 'ok', data: { id: 7, mes: 9, ano: 2026, status: 'em_validacao', dias: [{ data: '2026-09-04', vagas_total: 3, vagas_preenchidas: 2 }] } })),
    http.get(`${BASE}/escalas/7/resumo-servicos`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ militar_id: 1, nome: 'Alfa', posto: 'SD', total: 5, semana: 2, fim_semana_feriado: 3 }] })),
  );
}

it('mostra a prevista (cobertura) e o resumo', async () => {
  mockBase();
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  expect(await screen.findByText('2026-09-04')).toBeInTheDocument();
  expect(screen.getByText('2/3')).toBeInTheDocument();
  expect(screen.getByText('SD Alfa')).toBeInTheDocument();
});

it('aprovar → notificação de sucesso', async () => {
  mockBase();
  server.use(http.post(`${BASE}/escalas/7/validar`, () => HttpResponse.json({ success: true, message: 'ok', data: { id: 1, escala_versao_id: 1, gestor_id: 1, status: 'aprovada', justificativa: null, created_at: '2026-09-01T00:00:00.000Z' } }, { status: 201 })));
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /aprovar/i }));
  await waitFor(() => expect(screen.getByText(/escala aprovada/i)).toBeInTheDocument());
});

it('rejeitar exige justificativa (botão confirmar desabilitado sem texto)', async () => {
  mockBase();
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  expect(screen.getByRole('button', { name: /confirmar rejeição/i })).toBeDisabled();
});

it('409 ao aprovar → notificação de recarga', async () => {
  mockBase();
  server.use(http.post(`${BASE}/escalas/7/validar`, () => HttpResponse.json({ success: false, message: 'A escala não está em validação.', data: null }, { status: 409 })));
  renderWithProviders(<AprovacaoEscalaScreen escalaId={7} />);
  await screen.findByText('SD Alfa');
  await userEvent.click(screen.getByRole('button', { name: /aprovar/i }));
  await waitFor(() => expect(screen.getByText(/recarregue/i)).toBeInTheDocument());
});
