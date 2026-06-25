// apps/web/src/routes/_app/validacao/escalas/gestorDia.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/msw';
import { renderWithProviders } from '../../../../test/render';
import { GestorDiaScreen } from './$id.dias.$data';

const BASE = 'http://localhost:3000/api/v1';

function diaRegistrada(over: any = {}) {
  return {
    escala_id: 2, data: '2026-06-25', execucao_status: 'registrada', validado_em: null, justificativa: null,
    guarnicoes: [{
      id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
      vagas: [{ id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00',
        execucao: { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: null } }],
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

it('gestor valida o dia e mostra notificação', async () => {
  mockBase(diaRegistrada());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/validar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaRegistrada({ execucao_status: 'validada', validado_em: '2026-06-25T12:00:00.000Z' }) })));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /^validar$/i }));
  await waitFor(() => expect(screen.getByText(/execução validada/i)).toBeInTheDocument());
});

it('rejeitar exige justificativa (botão confirmar desabilitado sem texto)', async () => {
  mockBase(diaRegistrada());
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  expect(screen.getByRole('button', { name: /confirmar rejeição/i })).toBeDisabled();
});

it('rejeitar com justificativa envia e notifica', async () => {
  mockBase(diaRegistrada());
  server.use(http.post(`${BASE}/escalas/2/execucao/2026-06-25/validar`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: diaRegistrada({ execucao_status: 'rejeitada', justificativa: 'refazer' }) })));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  await userEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
  await userEvent.type(screen.getByLabelText(/justificativa/i), 'refazer');
  await userEvent.click(screen.getByRole('button', { name: /confirmar rejeição/i }));
  await waitFor(() => expect(screen.getByText(/execução rejeitada/i)).toBeInTheDocument());
});

it('quando já validada, não mostra ações', async () => {
  mockBase(diaRegistrada({ execucao_status: 'validada', validado_em: '2026-06-25T12:00:00.000Z' }));
  renderWithProviders(<GestorDiaScreen escalaId={2} data="2026-06-25" />);
  await screen.findByText(/validação — 2026-06-25/i);
  expect(screen.queryByRole('button', { name: /^validar$/i })).not.toBeInTheDocument();
});
