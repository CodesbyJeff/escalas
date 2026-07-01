import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import { SeletorDeDia, corCobertura } from './SeletorDeDia';

it('chama onSelecionar com a data ISO do dia clicado', async () => {
  const onSelecionar = vi.fn();
  renderWithProviders(<SeletorDeDia mes={3} ano={2026} onSelecionar={onSelecionar} />);
  await userEvent.click(screen.getByText('15'));
  expect(onSelecionar).toHaveBeenCalledWith('2026-03-15');
});

describe('corCobertura', () => {
  it('retorna null se d é undefined', () => {
    expect(corCobertura(undefined)).toBe(null);
  });
  it('retorna null se vagas_total === 0', () => {
    expect(corCobertura({ data: '2026-03-15', vagas_total: 0, vagas_preenchidas: 0 })).toBe(null);
  });
  it('retorna verde se vagas_preenchidas >= vagas_total', () => {
    expect(corCobertura({ data: '2026-03-15', vagas_total: 3, vagas_preenchidas: 3 })).toBe('verde');
  });
  it('retorna amarelo se vagas_preenchidas < vagas_total', () => {
    expect(corCobertura({ data: '2026-03-15', vagas_total: 3, vagas_preenchidas: 1 })).toBe('amarelo');
  });
});
