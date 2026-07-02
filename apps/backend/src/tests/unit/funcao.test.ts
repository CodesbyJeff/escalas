import { describe, it, expect } from 'vitest';
import { normalizeFuncao } from '../../utils/funcao.js';

describe('normalizeFuncao', () => {
  it('iguala caixa, acento e espaços', () => {
    expect(normalizeFuncao('Comandante')).toBe('COMANDANTE');
    expect(normalizeFuncao('  socorrista ')).toBe('SOCORRISTA');
    expect(normalizeFuncao('Auxílio  Médico')).toBe('AUXILIO MEDICO');
  });
});
