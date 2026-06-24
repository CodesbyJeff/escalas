import { describe, it, expect } from 'vitest';
import { feriadosBrasil } from '../../utils/feriados.js';

describe('feriadosBrasil', () => {
  describe('Páscoa e feriados móveis', () => {
    it('2025: Páscoa em 20/04 → Sexta-feira Santa em 18/04', () => {
      const feriados = feriadosBrasil(2025);
      const sextaSanta = feriados.find(f => f.descricao === 'Sexta-feira Santa');
      expect(sextaSanta).toBeDefined();
      expect(sextaSanta!.data.toISOString()).toBe('2025-04-18T00:00:00.000Z');
    });

    it('2025: Corpus Christi em 19/06 (Páscoa + 60 dias)', () => {
      const feriados = feriadosBrasil(2025);
      const corpus = feriados.find(f => f.descricao === 'Corpus Christi');
      expect(corpus).toBeDefined();
      expect(corpus!.data.toISOString()).toBe('2025-06-19T00:00:00.000Z');
    });

    it('2025: Terça-feira de Carnaval em 04/03 (Páscoa − 47 dias)', () => {
      const feriados = feriadosBrasil(2025);
      const terca = feriados.find(f => f.descricao === 'Terça-feira de Carnaval');
      expect(terca).toBeDefined();
      expect(terca!.data.toISOString()).toBe('2025-03-04T00:00:00.000Z');
    });

    it('2025: Segunda-feira de Carnaval em 03/03 (Páscoa − 48 dias)', () => {
      const feriados = feriadosBrasil(2025);
      const segunda = feriados.find(f => f.descricao === 'Segunda-feira de Carnaval');
      expect(segunda).toBeDefined();
      expect(segunda!.data.toISOString()).toBe('2025-03-03T00:00:00.000Z');
    });

    it('2024: Páscoa em 31/03 → Sexta-feira Santa em 29/03', () => {
      const feriados = feriadosBrasil(2024);
      const sextaSanta = feriados.find(f => f.descricao === 'Sexta-feira Santa');
      expect(sextaSanta).toBeDefined();
      expect(sextaSanta!.data.toISOString()).toBe('2024-03-29T00:00:00.000Z');
    });

    it('2026: Páscoa em 05/04 → Sexta-feira Santa em 03/04', () => {
      const feriados = feriadosBrasil(2026);
      const sextaSanta = feriados.find(f => f.descricao === 'Sexta-feira Santa');
      expect(sextaSanta).toBeDefined();
      expect(sextaSanta!.data.toISOString()).toBe('2026-04-03T00:00:00.000Z');
    });
  });

  describe('Feriados fixos', () => {
    it('2025: Independência do Brasil em 07/09', () => {
      const feriados = feriadosBrasil(2025);
      const independencia = feriados.find(f => f.descricao === 'Independência do Brasil');
      expect(independencia).toBeDefined();
      expect(independencia!.data.toISOString()).toBe('2025-09-07T00:00:00.000Z');
    });

    it('contém todos os feriados fixos esperados para 2025', () => {
      const feriados = feriadosBrasil(2025);
      const descricoes = feriados.map(f => f.descricao);
      expect(descricoes).toContain('Confraternização Universal');
      expect(descricoes).toContain('Tiradentes');
      expect(descricoes).toContain('Dia do Trabalho');
      expect(descricoes).toContain('Independência do Brasil');
      expect(descricoes).toContain('Nossa Senhora Aparecida');
      expect(descricoes).toContain('Finados');
      expect(descricoes).toContain('Proclamação da República');
      expect(descricoes).toContain('Natal');
    });
  });

  describe('Consciência Negra (Lei 14.759/2023)', () => {
    it('presente em 2025', () => {
      const feriados = feriadosBrasil(2025);
      const consciencia = feriados.find(f => f.descricao === 'Dia da Consciência Negra');
      expect(consciencia).toBeDefined();
      expect(consciencia!.data.toISOString()).toBe('2025-11-20T00:00:00.000Z');
    });

    it('presente em 2024', () => {
      const feriados = feriadosBrasil(2024);
      const consciencia = feriados.find(f => f.descricao === 'Dia da Consciência Negra');
      expect(consciencia).toBeDefined();
      expect(consciencia!.data.toISOString()).toBe('2024-11-20T00:00:00.000Z');
    });

    it('ausente em 2023', () => {
      const feriados = feriadosBrasil(2023);
      const consciencia = feriados.find(f => f.descricao === 'Dia da Consciência Negra');
      expect(consciencia).toBeUndefined();
    });
  });

  describe('Ordenação e integridade', () => {
    it('lista ordenada por data ascendente', () => {
      const feriados = feriadosBrasil(2025);
      for (let i = 1; i < feriados.length; i++) {
        expect(feriados[i]!.data.getTime()).toBeGreaterThanOrEqual(feriados[i - 1]!.data.getTime());
      }
    });

    it('todas as datas à meia-noite UTC', () => {
      const feriados = feriadosBrasil(2025);
      for (const f of feriados) {
        expect(f.data.getUTCHours()).toBe(0);
        expect(f.data.getUTCMinutes()).toBe(0);
        expect(f.data.getUTCSeconds()).toBe(0);
        expect(f.data.getUTCMilliseconds()).toBe(0);
      }
    });

    it('todas as datas pertencem ao ano pedido', () => {
      const feriados = feriadosBrasil(2025);
      for (const f of feriados) {
        expect(f.data.getUTCFullYear()).toBe(2025);
      }
    });
  });

  describe('Tipos corretos', () => {
    it('Sexta-feira Santa é nacional', () => {
      const feriados = feriadosBrasil(2025);
      const sextaSanta = feriados.find(f => f.descricao === 'Sexta-feira Santa');
      expect(sextaSanta!.tipo).toBe('nacional');
    });

    it('Segunda-feira de Carnaval é facultativo', () => {
      const feriados = feriadosBrasil(2025);
      const segunda = feriados.find(f => f.descricao === 'Segunda-feira de Carnaval');
      expect(segunda!.tipo).toBe('facultativo');
    });

    it('Terça-feira de Carnaval é facultativo', () => {
      const feriados = feriadosBrasil(2025);
      const terca = feriados.find(f => f.descricao === 'Terça-feira de Carnaval');
      expect(terca!.tipo).toBe('facultativo');
    });

    it('Corpus Christi é facultativo', () => {
      const feriados = feriadosBrasil(2025);
      const corpus = feriados.find(f => f.descricao === 'Corpus Christi');
      expect(corpus!.tipo).toBe('facultativo');
    });
  });
});
