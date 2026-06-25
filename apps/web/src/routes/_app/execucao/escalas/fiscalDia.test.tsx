// apps/web/src/routes/_app/execucao/escalas/fiscalDia.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { FiscalDiaScreen } from './$id.dias.$data';

const BASE = 'http://localhost:3000/api/v1';

function diaPendente(over: any = {}) {
  return {
    escala_id: 2, data: '2026-06-25', execucao_status: 'pendente', validado_em: null, justificativa: null,
    guarnicoes: [{
      id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null }],
    }],
    ...over,
  };
}
function mockBase(dia: any) {
  server.use(
    http.get(`${BASE}/escalas/2/execucao/2026-06-25`, () => HttpResponse.json({ success: true, message: 'ok', data: dia })),
    http.get(`${BASE}/escalas/2/militares`, () => HttpResponse.json({ success: true, message: 'ok', data: [{ id: 4, nome: 'Francisco Filho', nome_curto: 'FILHO', posto: 'SD', matricula: 'M1' }] })),
  );
}

it('fiscal salva a execução e mostra notificação', async () => {
  mockBase(diaPendente());
  server.use(http.put(`${BASE}/escalas/2/execucao/2026-06-25`, () => HttpResponse.json({ success: true, message: 'ok', data: diaPendente() })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
  await waitFor(() => expect(screen.getByText(/execução salva/i)).toBeInTheDocument());
});

it('mostra alerta inline no 422 ao salvar', async () => {
  mockBase(diaPendente());
  server.use(http.put(`${BASE}/escalas/2/execucao/2026-06-25`, () =>
    HttpResponse.json({ success: false, message: 'Vaga 99 não pertence ao dia.', data: null }, { status: 422 })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
  await waitFor(() => {
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((el) => /não pertence ao dia/i.test(el.textContent ?? ''))).toBe(true);
  });
});

it('fecha para validação com confirmação', async () => {
  mockBase(diaPendente());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/fechar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaPendente({ execucao_status: 'registrada' }) })));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /fechar para validação/i }));
  // confirma no modal
  await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => expect(screen.getByText(/execução fechada/i)).toBeInTheDocument());
});

it('quando registrada, fica somente leitura (sem botões de ação)', async () => {
  mockBase(diaPendente({ execucao_status: 'registrada',
    guarnicoes: [{ id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }] }] }));
  renderWithProviders(<FiscalDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/execução — 2026-06-25/i);
  expect(screen.queryByRole('button', { name: /^salvar$/i })).not.toBeInTheDocument();
  expect(screen.getByText(/aguardando validação/i)).toBeInTheDocument();
});
