import { describe, expect, it } from 'vitest';
import { ehUsuarioSeedTeste } from './seedData.js';

describe('ehUsuarioSeedTeste', () => {
  it('soldado-teste (sem sisbom_id, não super) → true', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: null, is_super_admin: false })).toBe(true);
  });
  it('super-admin local (sem sisbom_id, super) → false (preserva login)', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: null, is_super_admin: true })).toBe(false);
  });
  it('militar real do SISBOM (com sisbom_id) → false', () => {
    expect(ehUsuarioSeedTeste({ sisbom_id: 'abc-123', is_super_admin: false })).toBe(false);
  });
});
