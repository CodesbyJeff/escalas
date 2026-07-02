import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw';
import { renderWithProviders } from '../test/render';
import { MilitarPicker } from './MilitarPicker';

const BASE = 'http://localhost:3000/api/v1';

it('busca e seleciona um militar', async () => {
  server.use(http.get(`${BASE}/escalas/1/militares`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { id: 100, nome: 'Ana Paula', nome_curto: 'Ana', matricula: '111', posto: 'SD', patente_id: null, patente_sigla: null },
    ] }),
  ));
  const onChange = vi.fn();
  renderWithProviders(<MilitarPicker escalaId={1} value={null} onChange={onChange} />);
  await userEvent.click(screen.getByPlaceholderText(/buscar militar/i));
  await userEvent.click(await screen.findByText(/Ana Paula/));
  expect(onChange).toHaveBeenCalledWith(100);
});

it('destaca militar fora da regra de patente com ⚠ no rótulo', async () => {
  server.use(http.get(`${BASE}/escalas/1/militares`, () =>
    HttpResponse.json({ success: true, message: 'ok', data: [
      { id: 200, nome: 'Carlos Souza', nome_curto: 'Carlos', matricula: '222', posto: '1º SGT', patente_id: 12, patente_sigla: '1º SGT' },
      { id: 300, nome: 'Bruno Lima', nome_curto: 'Bruno', matricula: '333', posto: 'SD', patente_id: 99, patente_sigla: 'SD' },
    ] }),
  ));
  const onChange = vi.fn();
  renderWithProviders(
    <MilitarPicker escalaId={1} value={null} onChange={onChange} patentesEsperadas={[12]} />,
  );
  await userEvent.click(screen.getByPlaceholderText(/buscar militar/i));
  const elegivel = await screen.findByText(/Carlos Souza/);
  const inelegivel = await screen.findByText(/Bruno Lima/);
  expect(inelegivel.textContent).toMatch(/⚠/);
  expect(elegivel.textContent).not.toMatch(/⚠/);
});
