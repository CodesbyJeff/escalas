import { renderHook, act } from '@testing-library/react';
import { useLayoutDraft } from './useLayoutDraft';

it('inicia vazio e adiciona guarnição/vaga; toPayload monta o input', () => {
  const { result } = renderHook(() => useLayoutDraft());
  act(() => result.current.setNome('Dia Útil'));
  act(() => result.current.addGuarnicao());
  act(() => result.current.addVaga(0));
  const p = result.current.toPayload();
  expect(p.nome).toBe('Dia Útil');
  expect(p.guarnicoes[0]!.vagas_sugeridas.length).toBeGreaterThanOrEqual(1);
});
