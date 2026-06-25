// apps/web/src/features/execucao/ExecucaoVagaRow.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { ExecucaoVagaRow } from './ExecucaoVagaRow';

const BASE = 'http://localhost:3000/api/v1';
const vaga: any = { id: 10, funcao: 'Comandante', militar_id: 4, turno_inicio: '07:00', turno_fim: '19:00', execucao: null };
const draftBase: any = { vaga_id: 10, situacao: 'presente', militar_executado_id: null, do: false, observacoes: '' };

it('modo registrar: presente esconde o picker de substituto', () => {
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={draftBase} onChange={() => {}} />,
  );
  expect(screen.queryByPlaceholderText(/buscar militar/i)).not.toBeInTheDocument();
});

it('modo registrar: substituído mostra o picker', () => {
  server.use(http.get(`${BASE}/escalas/2/militares`, () => HttpResponse.json({ success: true, message: 'ok', data: [] })));
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={{ ...draftBase, situacao: 'substituido' }} onChange={() => {}} />,
  );
  expect(screen.getByPlaceholderText(/buscar militar/i)).toBeInTheDocument();
});

it('modo registrar: alternar DO chama onChange', async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <ExecucaoVagaRow escalaId={2} vaga={vaga} getMilitarNome={() => 'SD Filho'} mode="registrar" draft={draftBase} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith({ do: true });
});

it('modo validar: mostra a situação registrada como badge', () => {
  const vagaEx: any = { ...vaga, execucao: { vaga_id: 10, situacao: 'falta', militar_executado_id: null, do: false, observacoes: null } };
  renderWithProviders(<ExecucaoVagaRow escalaId={2} vaga={vagaEx} getMilitarNome={() => 'X'} mode="validar" />);
  expect(screen.getByText(/^falta$/i)).toBeInTheDocument();
});
