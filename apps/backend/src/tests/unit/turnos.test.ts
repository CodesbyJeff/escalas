import { describe, it, expect } from 'vitest';
import { parseHHmm, turnosSobrepoem, encontrarConflitos } from '../../utils/turnos.js';

describe('parseHHmm', () => {
  it('converte HH:mm válido em minutos', () => {
    expect(parseHHmm('07:30')).toBe(450);
    expect(parseHHmm('00:00')).toBe(0);
    expect(parseHHmm('23:59')).toBe(1439);
  });

  it('lança em formato inválido', () => {
    expect(() => parseHHmm('7am')).toThrow();
    expect(() => parseHHmm('25:00')).toThrow();
    expect(() => parseHHmm('12:60')).toThrow();
    expect(() => parseHHmm('')).toThrow();
  });
});

describe('turnosSobrepoem', () => {
  it('detecta sobreposição parcial diurna', () => {
    expect(turnosSobrepoem('07:00', '19:00', '12:00', '15:00')).toBe(true);
  });

  it('turnos disjuntos não sobrepõem', () => {
    expect(turnosSobrepoem('07:00', '13:00', '13:00', '19:00')).toBe(false);
  });

  it('turno noturno sobrepõe manhã do dia seguinte', () => {
    // 19:00–07:00 cobre 06:00–07:00
    expect(turnosSobrepoem('19:00', '07:00', '06:00', '08:00')).toBe(true);
  });

  it('dois turnos noturnos iguais sobrepõem', () => {
    expect(turnosSobrepoem('19:00', '07:00', '19:00', '07:00')).toBe(true);
  });

  it('noturno e tarde disjuntos não sobrepõem', () => {
    // 19:00–07:00 vs 12:00–18:00
    expect(turnosSobrepoem('19:00', '07:00', '12:00', '18:00')).toBe(false);
  });
});

describe('encontrarConflitos', () => {
  it('aponta militar em duas vagas sobrepostas', () => {
    const conflitos = encontrarConflitos([
      { id: 1, militar_id: 50, turno_inicio: '07:00', turno_fim: '19:00' },
      { id: 2, militar_id: 50, turno_inicio: '12:00', turno_fim: '15:00' },
      { id: 3, militar_id: 60, turno_inicio: '07:00', turno_fim: '19:00' },
    ]);
    expect(conflitos).toEqual([{ militar_id: 50, vaga_ids: [1, 2] }]);
  });

  it('ignora vagas sem militar e turnos disjuntos', () => {
    const conflitos = encontrarConflitos([
      { id: 1, militar_id: null, turno_inicio: '07:00', turno_fim: '19:00' },
      { id: 2, militar_id: 50, turno_inicio: '07:00', turno_fim: '13:00' },
      { id: 3, militar_id: 50, turno_inicio: '13:00', turno_fim: '19:00' },
    ]);
    expect(conflitos).toEqual([]);
  });
});
