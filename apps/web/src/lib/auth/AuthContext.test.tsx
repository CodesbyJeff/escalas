import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { AuthProvider, useAuth } from './AuthContext';

const BASE = 'http://localhost:3000/api/v1';
const user = { id: 1, cpf: '00000000000', matricula: '123', nome: 'ST Paiva', is_super_admin: false, roles: [{ role: 'ESCALANTE', lotacao_id: 10 }] };

function Probe() {
  const { user: u, login } = useAuth();
  return (
    <div>
      <span>{u ? u.nome : 'anon'}</span>
      <button onClick={() => login({ cpf: '00000000000', senha: 'x' })}>entrar</button>
    </div>
  );
}

it('login popula o usuário', async () => {
  server.use(
    http.post(`${BASE}/auth/login`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: { token: 't', refresh_token: 'r', user } }),
    ),
  );
  renderWithProviders(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByText('anon')).toBeInTheDocument();
  await userEvent.click(screen.getByText('entrar'));
  await waitFor(() => expect(screen.getByText('ST Paiva')).toBeInTheDocument());
});
