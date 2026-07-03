import { describe, expect, it } from 'vitest';
import { patentesMaisRecentes } from './patenteBackfill.service.js';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';

const doc = (date_start: string, membros: { id: string; pat: number | null }[]): MapaGuarnicaoDoc => ({
  _lotacao: 'L1', date_start,
  guarnicao: membros.map((m) => ({ _id: m.id, _patente: m.pat })),
});

describe('patentesMaisRecentes', () => {
  it('escolhe a patente do serviço mais recente por militar', () => {
    const map = patentesMaisRecentes([
      doc('2025-01-10', [{ id: 'mil-A', pat: 17 }]),
      doc('2025-06-20', [{ id: 'mil-A', pat: 12 }]), // mais recente
      doc('2025-03-01', [{ id: 'mil-A', pat: 13 }]),
    ]);
    expect(map.get('mil-A')).toBe(12);
  });

  it('ignora membros sem patente e sem id', () => {
    const map = patentesMaisRecentes([
      doc('2025-01-10', [{ id: 'mil-B', pat: null }, { id: '', pat: 5 }]),
    ]);
    expect(map.has('mil-B')).toBe(false);
    expect(map.size).toBe(0);
  });

  it('agrega vários militares de vários serviços', () => {
    const map = patentesMaisRecentes([
      doc('2025-05-01', [{ id: 'mil-A', pat: 6 }, { id: 'mil-C', pat: 20 }]),
      doc('2025-05-02', [{ id: 'mil-C', pat: 19 }]),
    ]);
    expect(map.get('mil-A')).toBe(6);
    expect(map.get('mil-C')).toBe(19); // 05-02 > 05-01
  });
});
