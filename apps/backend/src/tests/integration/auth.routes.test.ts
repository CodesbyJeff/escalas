import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { sisbomClient } from '../../integrations/sisbom/client.js';

beforeEach(() => {
  vi.spyOn(sisbomClient, 'loginAd').mockReset();
});

describe('POST /api/v1/auth/login', () => {
  it('422 se cpf inválido', async () => {
    const r = await request(buildApp()).post('/api/v1/auth/login').send({ cpf: 'x', senha: 'y' });
    expect(r.status).toBe(422);
    expect(r.body.success).toBe(false);
  });

  it('401 se sisbom rejeita', async () => {
    vi.spyOn(sisbomClient, 'loginAd').mockResolvedValue(false);
    const r = await request(buildApp()).post('/api/v1/auth/login').send({ cpf: '11122233344', senha: 'errada' });
    expect(r.status).toBe(401);
  });

  it('200 com tokens quando ok', async () => {
    vi.spyOn(sisbomClient, 'loginAd').mockResolvedValue(true);
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'X', last_sync_at: new Date() },
    });
    const r = await request(buildApp()).post('/api/v1/auth/login').send({ cpf: '11122233344', senha: 'ok' });
    expect(r.status).toBe(200);
    expect(r.body.data.token).toBeTypeOf('string');
  });

  it('200 login local com senha_hash (sem SISBOM)', async () => {
    const spy = vi.spyOn(sisbomClient, 'loginAd').mockResolvedValue(false);
    const hash = await bcrypt.hash('admin-escalas-2026', 10);
    await testPrisma.user.create({
      data: {
        cpf: '99999999900',
        nome: 'Admin Local',
        is_super_admin: true,
        senha_hash: hash,
        last_sync_at: new Date(),
      },
    });
    const r = await request(buildApp())
      .post('/api/v1/auth/login')
      .send({ cpf: '99999999900', senha: 'admin-escalas-2026' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.token).toBeTypeOf('string');
    expect(r.body.data.user.is_super_admin).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
