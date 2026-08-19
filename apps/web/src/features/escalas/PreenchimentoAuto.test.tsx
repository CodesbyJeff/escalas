import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { PreenchimentoAuto } from './PreenchimentoAuto';

const BASE = 'http://localhost:3000/api/v1';

const sugestoes = [
  {
    vaga_id: 1,
    data: '2026-09-01',
    guarnicao_sigla: 'ABT-01',
    funcao: 'comandante',
    militar_id: 7,
    militar_nome: 'Militar 7',
    motivo: 'menor contagem no período',
    aviso_patente: false,
    aviso_descanso: false,
  },
];

it('usa heading nível 2 para o título de seção (não pula nível sob o h1 da página)', () => {
  renderWithProviders(<PreenchimentoAuto escalaId={1} rascunho />);
  expect(screen.getByRole('heading', { level: 2, name: /preenchimento automático/i })).toBeInTheDocument();
});

it('pré-visualiza e renderiza uma linha com militar e motivo', async () => {
  server.use(
    http.post(`${BASE}/escalas/1/sugerir-preenchimento`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: sugestoes })),
  );
  renderWithProviders(<PreenchimentoAuto escalaId={1} rascunho />);

  await userEvent.type(screen.getByLabelText(/data início/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/data fim/i), '2026-09-30');
  await userEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));

  await waitFor(() => expect(screen.getByText('Militar 7')).toBeInTheDocument());
  expect(screen.getByText('menor contagem no período')).toBeInTheDocument();
});

it('aplica o preenchimento, mostra a notificação e invalida a query da escala', async () => {
  server.use(
    http.post(`${BASE}/escalas/1/sugerir-preenchimento`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: sugestoes })),
    http.post(`${BASE}/escalas/1/aplicar-preenchimento`, () =>
      HttpResponse.json({
        success: true, message: 'ok',
        data: { vagas_preenchidas: 1, avisos_patente: 0, avisos_descanso: 0 },
      })),
  );
  renderWithProviders(<PreenchimentoAuto escalaId={1} rascunho />);

  await userEvent.type(screen.getByLabelText(/data início/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/data fim/i), '2026-09-30');
  await userEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));
  await waitFor(() => expect(screen.getByText('Militar 7')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /aplicar/i }));

  await waitFor(() =>
    expect(screen.getByText(/1 vagas preenchidas/i)).toBeInTheDocument(),
  );
});

it('mostra a mensagem de erro quando aplicar retorna 409 por escala publicada', async () => {
  server.use(
    http.post(`${BASE}/escalas/1/sugerir-preenchimento`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: sugestoes })),
    http.post(`${BASE}/escalas/1/aplicar-preenchimento`, () =>
      HttpResponse.json(
        { success: false, message: 'Escala não está em rascunho.', data: null },
        { status: 409 },
      )),
  );
  renderWithProviders(<PreenchimentoAuto escalaId={1} rascunho />);

  await userEvent.type(screen.getByLabelText(/data início/i), '2026-09-01');
  await userEvent.type(screen.getByLabelText(/data fim/i), '2026-09-30');
  await userEvent.click(screen.getByRole('button', { name: /pré-visualizar/i }));
  await waitFor(() => expect(screen.getByText('Militar 7')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /aplicar/i }));

  await waitFor(() =>
    expect(screen.getByText(/escala não está em rascunho/i)).toBeInTheDocument(),
  );
});
