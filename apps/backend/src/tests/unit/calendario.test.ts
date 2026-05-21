import { describe, it, expect } from 'vitest';
import { diasDoMes } from '../../utils/calendario.js';

describe('diasDoMes', () => {
  it('retorna 31 dias para janeiro', () => {
    expect(diasDoMes(1, 2026)).toHaveLength(31);
  });

  it('retorna 28 dias para fevereiro não-bissexto', () => {
    expect(diasDoMes(2, 2026)).toHaveLength(28);
  });

  it('retorna 29 dias para fevereiro bissexto', () => {
    expect(diasDoMes(2, 2028)).toHaveLength(29);
  });

  it('retorna 30 dias para abril', () => {
    expect(diasDoMes(4, 2026)).toHaveLength(30);
  });

  it('cada data é UTC à meia-noite e sequencial', () => {
    const dias = diasDoMes(3, 2026);
    expect(dias[0]!.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(dias[30]!.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});
