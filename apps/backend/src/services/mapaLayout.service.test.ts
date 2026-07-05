import { describe, expect, it } from 'vitest';
import { agregarLayout } from './mapaLayout.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';

const doc = (atividade: string, time: [string, string], funcoes: string[]): MapaGuarnicaoDoc => ({
  _lotacao: 'L1', atividade, time_start: time[0], time_end: time[1],
  guarnicao: funcoes.map((f) => ({ _militar: 'x', str_funcao: f })),
});

describe('agregarLayout', () => {
  it('agrupa por atividade e cria uma guarnição por atividade (ordenadas)', () => {
    const out = agregarLayout([doc('INCENDIO', ['08:00', '08:00'], ['Comandante']), doc('RESGATE', ['08:00', '08:00'], ['Motorista'])]);
    expect(out.guarnicoes.map((g) => g.atividade)).toEqual(['INCENDIO', 'RESGATE']);
    expect(out.guarnicoes[0]!.ordem).toBe(0);
    expect(out.guarnicoes[1]!.ordem).toBe(1);
  });

  it('turno modal vence (08:00→08:00 aparece 2x, 07:00 1x)', () => {
    const out = agregarLayout([
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante']),
      doc('INCENDIO', ['07:00', '17:00'], ['Comandante']),
    ]);
    expect(out.guarnicoes[0]!.turno_padrao_inicio).toBe('08:00');
    expect(out.guarnicoes[0]!.turno_padrao_fim).toBe('08:00');
  });

  it('quantidade_sugerida = moda da contagem da função por serviço', () => {
    const out = agregarLayout([
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar', 'Auxiliar']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar', 'Auxiliar']),
      doc('INCENDIO', ['08:00', '08:00'], ['Comandante', 'Auxiliar']),
    ]);
    const vagas = out.guarnicoes[0]!.vagas_sugeridas;
    expect(vagas.find((v) => v.funcao === 'Comandante')!.quantidade_sugerida).toBe(1);
    expect(vagas.find((v) => v.funcao === 'Auxiliar')!.quantidade_sugerida).toBe(2); // moda: 2 (2 serviços) vs 1 (1 serviço)
  });

  it('função vazia vira "GUARNIÇÃO"; sigla trunca em 20; funcao em 60', () => {
    const out = agregarLayout([doc('SALVAMENTO AQUATICO LONGO NOME DEMAIS', ['07:00', '19:00'], ['', 'Mergulhador'])]);
    expect(out.guarnicoes[0]!.sigla.length).toBeLessThanOrEqual(20);
    expect(out.guarnicoes[0]!.vagas_sugeridas.some((v) => v.funcao === 'GUARNIÇÃO')).toBe(true);
  });

  it('turno inválido/ausente cai para 08:00→08:00', () => {
    const out = agregarLayout([doc('INCENDIO', ['', ''], ['Comandante'])]);
    expect(out.guarnicoes[0]!.turno_padrao_inicio).toBe('08:00');
    expect(out.guarnicoes[0]!.turno_padrao_fim).toBe('08:00');
  });

  it('patentes_esperadas = união distinta ordenada das patentes observadas por função (lotação-wide)', () => {
    const docPat = (atividade: string, membros: { funcao: string; pat: number | null }[]): MapaGuarnicaoDoc => ({
      _lotacao: 'L1', atividade, time_start: '08:00', time_end: '08:00',
      guarnicao: membros.map((m) => ({ _militar: 'x', str_funcao: m.funcao, _patente: m.pat })),
    });
    const out = agregarLayout([
      docPat('INCENDIO', [{ funcao: 'CMT_GU', pat: 12 }, { funcao: 'OP', pat: 17 }]),
      docPat('RESGATE', [{ funcao: 'CMT_GU', pat: 13 }, { funcao: 'OP', pat: null }]), // union lotação-wide p/ CMT_GU; null ignorado
    ]);
    const inc = out.guarnicoes.find((g) => g.atividade === 'INCENDIO')!;
    expect(inc.vagas_sugeridas.find((v) => v.funcao === 'CMT_GU')!.patentes_esperadas).toEqual([12, 13]);
    expect(inc.vagas_sugeridas.find((v) => v.funcao === 'OP')!.patentes_esperadas).toEqual([17]);
  });
});
