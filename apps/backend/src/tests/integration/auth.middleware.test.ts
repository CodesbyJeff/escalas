import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware } from '../../middlewares/auth.js';
import { signAccess } from '../../config/jwt.js';
import { testPrisma } from '../helpers/db.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ user_id: (req as { user?: { id: number } }).user?.id });
  });
  return app;
}

describe('authMiddleware', () => {
  it('401 sem authorization', async () => {
    const r = await request(makeApp()).get('/protected');
    expect(r.status).toBe(401);
  });

  it('401 com bearer inválido', async () => {
    const r = await request(makeApp()).get('/protected').set('authorization', 'Bearer abc');
    expect(r.status).toBe(401);
  });

  it('200 com bearer válido', async () => {
    const u = await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'X', last_sync_at: new Date() },
    });
    const token = signAccess({ user_id: u.id, cpf: u.cpf });
    const r = await request(makeApp()).get('/protected').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.user_id).toBe(u.id);
  });
});
