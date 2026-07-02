import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { LayoutEditor } from './LayoutEditor';
import { useLayoutDraft } from './useLayoutDraft';

function Harness() {
  const draft = useLayoutDraft();
  return <LayoutEditor draft={draft} onSalvar={() => {}} salvando={false} />;
}

it('mostra o campo Ciclo (dias) na guarnição e aceita valor', () => {
  renderWithProviders(<Harness />);
  const ciclo = screen.getByLabelText('Ciclo (dias)') as HTMLInputElement;
  expect(ciclo).toBeInTheDocument();
  fireEvent.change(ciclo, { target: { value: '4' } });
  expect(ciclo.value).toBe('4');
});
