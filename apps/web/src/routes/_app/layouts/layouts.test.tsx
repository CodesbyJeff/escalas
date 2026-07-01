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
