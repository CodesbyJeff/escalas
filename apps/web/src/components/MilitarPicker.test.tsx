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
      { id: 100, nome: 'Ana Paula', nome_curto: 'Ana', matricula: '111', posto: 'SD' },
    ] }),
  ));
  const onChange = vi.fn();
  renderWithProviders(<MilitarPicker escalaId={1} value={null} onChange={onChange} />);
  await userEvent.click(screen.getByPlaceholderText(/buscar militar/i));
  await userEvent.click(await screen.findByText(/Ana Paula/));
  expect(onChange).toHaveBeenCalledWith(100);
});
