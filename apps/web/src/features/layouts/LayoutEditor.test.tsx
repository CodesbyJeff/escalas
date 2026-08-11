import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { renderWithProviders } from '../../test/render';
import { LayoutEditor } from './LayoutEditor';
import { useLayoutDraft } from './useLayoutDraft';

const BASE = 'http://localhost:3000/api/v1';

const PATENTES = [
  { id: 12, forca_id: 0, sigla: '1º SGT', nome: '1º Sargento', ordem: 12 },
  { id: 13, forca_id: 0, sigla: '2º SGT', nome: '2º Sargento', ordem: 13 },
];

function mockPatentes() {
  server.use(http.get(`${BASE}/patentes`, () => HttpResponse.json({ success: true, message: 'ok', data: PATENTES })));
}

function Harness() {
  const draft = useLayoutDraft();
  return <LayoutEditor draft={draft} onSalvar={() => {}} salvando={false} />;
}

it('mostra o campo Ciclo (dias) na guarnição e aceita valor', () => {
  mockPatentes();
  renderWithProviders(<Harness />);
  const ciclo = screen.getByLabelText('Ciclo (dias)') as HTMLInputElement;
  expect(ciclo).toBeInTheDocument();
  fireEvent.change(ciclo, { target: { value: '4' } });
  expect(ciclo.value).toBe('4');
});

it('mostra o campo Patentes esperadas em cada vaga sugerida', () => {
  mockPatentes();
  renderWithProviders(<Harness />);
  expect(screen.getByRole('textbox', { name: 'Patentes esperadas' })).toBeInTheDocument();
});

function HarnessComEspelho() {
  const draft = useLayoutDraft();
  return (
    <>
      <LayoutEditor draft={draft} onSalvar={() => {}} salvando={false} />
      <span data-testid="politica">{draft.values.politica_localidade}</span>
    </>
  );
}

it('permite escolher a política de localidade e reflete no rascunho', () => {
  mockPatentes();
  renderWithProviders(<HarnessComEspelho />);
  expect(screen.getByTestId('politica')).toHaveTextContent('indiferente');
  fireEvent.click(screen.getByRole('radio', { name: 'Rodiziar' }));
  expect(screen.getByTestId('politica')).toHaveTextContent('rodizia');
});
