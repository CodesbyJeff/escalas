import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function setup() {
  const admin = await testPrisma.user.create({
    data: { cpf: '99988877766', nome: 'A', is_super_admin: true, last_sync_at: new Date() },
  });
  const lot = await testPrisma.lotacao.create({
    data: { id: 999, sigla: 'TEST', nome: 'Test', nivel: 1, operacional: true },
  });
  const user = await testPrisma.user.create({
    data: { cpf: '11122233344', nome: 'U', last_sync_at: new Date() },
  });
  const token = signAccess({ user_id: admin.id, cpf: admin.cpf });
  return { admin, user, lot, token };
}

describe('POST /api/v1/admin/roles', () => {
  it('403 sem super-admin', async () => {
    const { user, lot } = await setup();
    const r = await request(buildApp())
      .post('/api/v1/admin/roles')
      .set('authorization', `Bearer ${signAccess({ user_id: user.id, cpf: user.cpf })}`)
      .send({ user_id: user.id, role: 'ESCALANTE', lotacao_id: lot.id });
    expect(r.status).toBe(403);
  });

  it('200 com super-admin atribui role', async () => {
    const { user, lot, token } = await setup();
    const r = await request(buildApp())
      .post('/api/v1/admin/roles')
      .set('authorization', `Bearer ${token}`)
      .send({ user_id: user.id, role: 'ESCALANTE', lotacao_id: lot.id });
    expect(r.status).toBe(200);
    expect(r.body.data.role).toBe('ESCALANTE');
  });
});
