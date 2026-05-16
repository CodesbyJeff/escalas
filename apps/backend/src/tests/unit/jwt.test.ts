import { describe, it, expect } from 'vitest';
import { signAccess, signRefresh, verifyAccess, verifyRefresh } from '../../config/jwt.js';

describe('jwt', () => {
  it('signAccess gera token, verifyAccess recupera payload', () => {
    const token = signAccess({ user_id: 42, cpf: '11122233344' });
    const payload = verifyAccess(token);
    expect(payload.user_id).toBe(42);
    expect(payload.cpf).toBe('11122233344');
  });

  it('verifyAccess falha para token de refresh', () => {
    const refresh = signRefresh({ user_id: 42 });
    expect(() => verifyAccess(refresh)).toThrow();
  });

  it('verifyRefresh recupera user_id', () => {
    const refresh = signRefresh({ user_id: 42 });
    expect(verifyRefresh(refresh).user_id).toBe(42);
  });
});
