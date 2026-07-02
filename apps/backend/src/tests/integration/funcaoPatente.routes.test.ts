import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma, resetDb } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

// ─── helpers ────────────────────────────────────────────────────────────────

async function criarSuperAdmin() {
  const user = await testPrisma.user.create({
    data: { cpf: '999000001', nome: 'Super Admin', last_sync_at: new Date(), is_super_admin: true },
  });
  const token = signAccess({ user_id: user.id, cpf: user.cpf });
  return { user, token };
}

async function criarUsuarioComum() {
  const user = await testPrisma.user.create({
    data: { cpf: '999000002', nome: 'Usuario Comum', last_sync_at: new Date(), is_super_admin: false },
  });
  const token = signAccess({ user_id: user.id, cpf: user.cpf });
  return { user, token };
}

async function seedPatentes() {
  await testPrisma.patente.createMany({
    data: [
      { id: 11, forca_id: 1, sigla: 'CAP', nome: 'Capitão', ordem: 5 },
      { id: 12, forca_id: 1, sigla: 'TEN', nome: 'Tenente', ordem: 6 },
    ],
  });
}

async function seedLotacao() {
  return testPrisma.lotacao.create({
    data: { sigla: 'CTIC', nome: 'Centro de Tecnologia', nivel: 1 },
  });
}

// ─── setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await resetDb();
});

// ─── testes ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/patentes', () => {
  it('200 — autenticado retorna lista de patentes', async () => {
    await seedPatentes();
    const { token } = await criarUsuarioComum();

    const r = await request(buildApp())
      .get('/api/v1/patentes')
      .set('authorization', `Bearer ${token}`);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data).toHaveLength(2);
  });
});

describe('POST /api/v1/funcao-patentes', () => {
  it('201 depois 409 — cria regra global e rejeita duplicata no mesmo escopo', async () => {
    await seedPatentes();
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [12] });

    expect(post.status).toBe(201);
    expect(post.body.data.funcao_norm).toBe('COMANDANTE');
    expect(post.body.data.lotacao_id).toBeNull();
    expect(post.body.data.patente_ids).toEqual([12]);

    const dup = await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [11] });

    expect(dup.status).toBe(409);
  });

  it('403 — usuário comum não pode criar', async () => {
    await seedPatentes();
    const { token } = await criarUsuarioComum();

    const r = await request(buildApp())
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [12] });

    expect(r.status).toBe(403);
  });
});

describe('GET /api/v1/funcao-patentes', () => {
  it('sem query retorna globais; ?lotacao_id= retorna as da lotação', async () => {
    await seedPatentes();
    const lotacao = await seedLotacao();
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [12] });

    await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Motorista', lotacao_id: lotacao.id, patente_ids: [11] });

    const globais = await request(app)
      .get('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`);

    expect(globais.status).toBe(200);
    expect(globais.body.data).toHaveLength(1);
    expect(globais.body.data[0].funcao_norm).toBe('COMANDANTE');

    const daLotacao = await request(app)
      .get(`/api/v1/funcao-patentes?lotacao_id=${lotacao.id}`)
      .set('authorization', `Bearer ${token}`);

    expect(daLotacao.status).toBe(200);
    expect(daLotacao.body.data).toHaveLength(1);
    expect(daLotacao.body.data[0].funcao_norm).toBe('MOTORISTA');
  });
});

describe('PUT /api/v1/funcao-patentes/:id', () => {
  it('200 — altera patente_ids', async () => {
    await seedPatentes();
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [12] });

    const id = post.body.data.id as number;

    const put = await request(app)
      .put(`/api/v1/funcao-patentes/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ patente_ids: [11, 12] });

    expect(put.status).toBe(200);
    expect(put.body.data.patente_ids).toEqual([11, 12]);
  });
});

describe('DELETE /api/v1/funcao-patentes/:id', () => {
  it('200 — remove regra existente', async () => {
    await seedPatentes();
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`)
      .send({ funcao: 'Comandante', patente_ids: [12] });

    const id = post.body.data.id as number;

    const del = await request(app)
      .delete(`/api/v1/funcao-patentes/${id}`)
      .set('authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);

    const get = await request(app)
      .get('/api/v1/funcao-patentes')
      .set('authorization', `Bearer ${token}`);

    expect((get.body.data as Array<{ id: number }>).find((f) => f.id === id)).toBeUndefined();
  });

  it('404 — remoção de id inexistente', async () => {
    const { token } = await criarSuperAdmin();
    const r = await request(buildApp())
      .delete('/api/v1/funcao-patentes/999999')
      .set('authorization', `Bearer ${token}`);

    expect(r.status).toBe(404);
  });
});
