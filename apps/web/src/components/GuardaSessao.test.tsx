import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { server } from '../test/msw';
import { renderWithProviders } from '../test/render';
import { AuthProvider } from '../lib/auth/AuthContext';
import { setTokens } from '../lib/auth/storage';
import { GuardaSessao } from './GuardaSessao';

const BASE = 'http://localhost:3000/api/v1';
const user = {
  id: 1, cpf: '00000000000', matricula: '123', nome: 'ST Paiva',
  is_super_admin: false, roles: [{ role: 'ESCALANTE', lotacao_id: 10 }],
};

afterEach(() => localStorage.clear());

function render(onAnonimo: () => void) {
  renderWithProviders(
    <AuthProvider>
      <GuardaSessao onAnonimo={onAnonimo}>
        <div>conteúdo protegido</div>
      </GuardaSessao>
    </AuthProvider>,
  );
}

it('sessão expirada não renderiza conteúdo protegido — sinaliza anônimo', async () => {
  // token velho no storage: existe, mas o servidor recusa; o refresh também falhou
  setTokens('token-expirado', 'refresh-expirado');
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ success: false, message: 'Token expirado.' }, { status: 401 }),
    ),
    http.post(`${BASE}/auth/refresh`, () =>
      HttpResponse.json({ success: false, message: 'Refresh token inválido.' }, { status: 401 }),
    ),
  );
  const onAnonimo = vi.fn();

  render(onAnonimo);

  await waitFor(() => expect(onAnonimo).toHaveBeenCalled());
  expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
});

it('sessão válida renderiza o conteúdo protegido', async () => {
  setTokens('token-bom', 'refresh-bom');
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ success: true, message: 'ok', data: user }),
    ),
  );
  const onAnonimo = vi.fn();

  render(onAnonimo);

  await waitFor(() => expect(screen.getByText('conteúdo protegido')).toBeInTheDocument());
  expect(onAnonimo).not.toHaveBeenCalled();
});

it('sem token nenhum sinaliza anônimo sem chamar a API', async () => {
  const onAnonimo = vi.fn();

  render(onAnonimo);

  await waitFor(() => expect(onAnonimo).toHaveBeenCalled());
  expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument();
});
