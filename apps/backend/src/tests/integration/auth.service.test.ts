import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { authService, type AuthDeps } from '../../services/auth.service.js';

const fakeSisbom = {
  loginAd: vi.fn(),
  getMirrorRef: vi.fn(),
  getEvents: vi.fn(),
};

const deps: AuthDeps = { prisma: testPrisma, sisbom: fakeSisbom as never };

beforeEach(() => fakeSisbom.loginAd.mockReset());

describe('auth.service.login', () => {
  it('falha 401 se sisbom rejeita', async () => {
    fakeSisbom.loginAd.mockResolvedValue(false);
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Fulano', last_sync_at: new Date() },
    });
    await expect(authService.login({ cpf: '11122233344', senha: 'errada' }, deps))
      .rejects.toMatchObject({ status: 401 });
  });

  it('falha 404 se usuário não existe local mesmo com sisbom ok', async () => {
    fakeSisbom.loginAd.mockResolvedValue(true);
    await expect(authService.login({ cpf: '99988877766', senha: 'ok' }, deps))
      .rejects.toMatchObject({ status: 404 });
  });

  it('retorna tokens e user quando tudo ok', async () => {
    fakeSisbom.loginAd.mockResolvedValue(true);
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Fulano', last_sync_at: new Date() },
    });
    const r = await authService.login({ cpf: '11122233344', senha: 'ok' }, deps);
    expect(r.token).toBeTypeOf('string');
    expect(r.refresh_token).toBeTypeOf('string');
    expect(r.user.cpf).toBe('11122233344');
  });
});
