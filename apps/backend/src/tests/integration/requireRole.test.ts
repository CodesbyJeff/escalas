import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware } from '../../middlewares/auth.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { signAccess } from '../../config/jwt.js';
import { testPrisma } from '../helpers/db.js';
import { ok } from '../../utils/response.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get(
    '/escalante-only',
    authMiddleware,
    requireRole(['ESCALANTE']),
    (_req, res) => ok(res, 'ok', null),
  );
  app.get(
    '/escalante-da-lotacao/:lotacao_id',
    authMiddleware,
    requireRole(['ESCALANTE'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }),
    (_req, res) => ok(res, 'ok', null),
  );
  return app;
}

async function seed(
  opts: { is_super?: boolean; role?: 'ESCALANTE' | 'MILITAR' | 'GESTOR'; lotacao_id?: number } = {},
) {
  const lotacao = await testPrisma.lotacao.create({
    data: { id: 999, sigla: 'TEST', nome: 'Test', nivel: 1, operacional: true },
  });
  const user = await testPrisma.user.create({
    data: { cpf: '11122233344', nome: 'U', is_super_admin: !!opts.is_super, last_sync_at: new Date() },
  });
  if (opts.role) {
    await testPrisma.userRole.create({
      data: {
        user_id: user.id,
        role: opts.role,
        lotacao_id: opts.lotacao_id ?? null,
        created_by: user.id,
      },
    });
  }
  const token = signAccess({ user_id: user.id, cpf: user.cpf });
  return { user, lotacao, token };
}

describe('requireRole', () => {
  it('403 sem nenhuma role', async () => {
    const { token } = await seed();
    const r = await request(makeApp()).get('/escalante-only').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });

  it('200 quando user tem role', async () => {
    const { token } = await seed({ role: 'ESCALANTE' });
    const r = await request(makeApp()).get('/escalante-only').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('200 quando super-admin (bypass)', async () => {
    const { token } = await seed({ is_super: true });
    const r = await request(makeApp()).get('/escalante-only').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('403 quando role é da lotacao errada', async () => {
    const { token, lotacao } = await seed({ role: 'ESCALANTE', lotacao_id: 999 });
    const otherLot = await testPrisma.lotacao.create({
      data: { id: 998, sigla: 'OUTRA', nome: 'Outra', nivel: 1, operacional: true },
    });
    const r = await request(makeApp())
      .get(`/escalante-da-lotacao/${otherLot.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(lotacao.id).toBe(999);
  });

  it('200 quando role é da lotacao certa', async () => {
    const { token, lotacao } = await seed({ role: 'ESCALANTE', lotacao_id: 999 });
    const r = await request(makeApp())
      .get(`/escalante-da-lotacao/${lotacao.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  it('200 quando super-admin acessa lotacao alheia', async () => {
    const { token, lotacao } = await seed({ is_super: true });
    const r = await request(makeApp())
      .get(`/escalante-da-lotacao/${lotacao.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });
});
