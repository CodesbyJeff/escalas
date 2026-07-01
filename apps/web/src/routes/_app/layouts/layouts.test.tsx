import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw';
import { renderWithProviders } from '../../../test/render';
import { LayoutsView } from './index';

const BASE = 'http://localhost:3000/api/v1';

const LOTACOES = [{ value: '100', label: '1BBM' }];

it('lista layouts da lotação selecionada', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/100`, () =>
      HttpResponse.json({
        success: true,
        message: 'ok',
        data: [{ id: 1, lotacao_id: 100, nome: 'Dia Útil', qtd_guarnicoes: 2 }],
      }),
    ),
  );
  renderWithProviders(<LayoutsView lotacoes={LOTACOES} />);
  // Mantine Select renders a textbox; click it to open dropdown
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  const option = await screen.findByText('1BBM');
  await userEvent.click(option);
  // Should show the layout
  expect(await screen.findByText('Dia Útil')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();
});

it('ao editar, popula o formulário com o layout carregado (não abre em branco)', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/100`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: [{ id: 7, lotacao_id: 100, nome: 'Operação X', qtd_guarnicoes: 1 }] })),
    http.get(`${BASE}/templates/7`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: {
        id: 7, lotacao_id: 100, nome: 'Operação X', criado_por_id: 3, updated_at: '2026-06-29T00:00:00.000Z',
        guarnicoes: [{ id: 1, sigla: 'ABT-01', atividade: 'Incêndio', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
          vagas_sugeridas: [{ id: 1, funcao: 'Comandante', quantidade_sugerida: 1 }] }],
      } })),
  );
  renderWithProviders(<LayoutsView lotacoes={LOTACOES} />);
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  await userEvent.click(await screen.findByText('1BBM'));
  await userEvent.click(await screen.findByRole('button', { name: /editar/i }));
  // o nome e a sigla da guarnição devem vir preenchidos (não em branco)
  expect(await screen.findByDisplayValue('Operação X')).toBeInTheDocument();
  expect(screen.getByDisplayValue('ABT-01')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Comandante')).toBeInTheDocument();
});

it('mostra mensagem de vazio quando não há layouts', async () => {
  server.use(
    http.get(`${BASE}/templates/lotacao/100`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: [] }),
    ),
  );
  renderWithProviders(<LayoutsView lotacoes={LOTACOES} />);
  await userEvent.click(screen.getByRole('textbox', { name: /lotação/i }));
  const option = await screen.findByText('1BBM');
  await userEvent.click(option);
  expect(await screen.findByText(/nenhum layout/i)).toBeInTheDocument();
});
