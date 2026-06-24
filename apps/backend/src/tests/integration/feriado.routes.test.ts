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

// ─── setup ──────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await testPrisma.feriado.deleteMany();
  await resetDb();
});

// ─── testes ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/feriados', () => {
  it('201 — super-admin cria feriado e aparece no GET', async () => {
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-07-04', descricao: 'Emancipação do município', tipo: 'municipal' });

    expect(post.status).toBe(201);
    expect(post.body.success).toBe(true);
    expect(post.body.data.descricao).toBe('Emancipação do município');

    const get = await request(app)
      .get('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`);

    expect(get.status).toBe(200);
    expect(get.body.data).toHaveLength(1);
    expect(get.body.data[0].descricao).toBe('Emancipação do município');
  });

  it('409 — data duplicada', async () => {
    const { token } = await criarSuperAdmin();
    const app = buildApp();
    const body = { data: '2026-07-04', descricao: 'Primeiro', tipo: 'estadual' };

    await request(app).post('/api/v1/feriados').set('authorization', `Bearer ${token}`).send(body);
    const dup = await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ ...body, descricao: 'Segundo' });

    expect(dup.status).toBe(409);
  });

  it('403 — usuário comum não pode criar', async () => {
    const { token } = await criarUsuarioComum();
    const r = await request(buildApp())
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-08-01', descricao: 'Foo', tipo: 'estadual' });

    expect(r.status).toBe(403);
  });

  it('422 — body inválido (descricao vazia)', async () => {
    const { token } = await criarSuperAdmin();
    const r = await request(buildApp())
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-08-01', descricao: '', tipo: 'estadual' });

    expect(r.status).toBe(422);
  });

  it('422 — data malformada', async () => {
    const { token } = await criarSuperAdmin();
    const r = await request(buildApp())
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '04/07/2026', descricao: 'Feriado', tipo: 'estadual' });

    expect(r.status).toBe(422);
  });
});

describe('GET /api/v1/feriados', () => {
  it('filtra por ?ano=2026 e ordena asc', async () => {
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    // cria um em 2026 e um em 2027
    await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-12-25', descricao: 'Natal 2026', tipo: 'nacional' });
    await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2027-01-01', descricao: 'Ano Novo 2027', tipo: 'nacional' });
    await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-06-24', descricao: 'São João 2026', tipo: 'estadual' });

    const r = await request(app)
      .get('/api/v1/feriados?ano=2026')
      .set('authorization', `Bearer ${token}`);

    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
    // ordenado asc por data
    expect(new Date(r.body.data[0].data) < new Date(r.body.data[1].data)).toBe(true);
    // todos do ano 2026
    r.body.data.forEach((f: { data: string }) => {
      expect(new Date(f.data).getFullYear()).toBe(2026);
    });
  });

  it('200 — acessível por usuário comum autenticado', async () => {
    const { token } = await criarUsuarioComum();
    const r = await request(buildApp())
      .get('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`);

    expect(r.status).toBe(200);
  });
});

describe('PUT /api/v1/feriados/:id', () => {
  it('200 — atualiza descricao e tipo, reflete no GET', async () => {
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-09-07', descricao: 'Independência', tipo: 'nacional' });

    const id = post.body.data.id as number;

    const put = await request(app)
      .put(`/api/v1/feriados/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ descricao: 'Independência atualizada', tipo: 'facultativo' });

    expect(put.status).toBe(200);
    expect(put.body.data.descricao).toBe('Independência atualizada');
    expect(put.body.data.tipo).toBe('facultativo');

    const get = await request(app)
      .get('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`);

    const found = (get.body.data as Array<{ id: number; descricao: string }>).find((f) => f.id === id);
    expect(found?.descricao).toBe('Independência atualizada');
  });

  it('404 — id inexistente', async () => {
    const { token } = await criarSuperAdmin();
    const r = await request(buildApp())
      .put('/api/v1/feriados/999999')
      .set('authorization', `Bearer ${token}`)
      .send({ descricao: 'X' });

    expect(r.status).toBe(404);
  });
});

describe('DELETE /api/v1/feriados/:id', () => {
  it('200 — remove e some do GET', async () => {
    const { token } = await criarSuperAdmin();
    const app = buildApp();

    const post = await request(app)
      .post('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`)
      .send({ data: '2026-11-15', descricao: 'Proclamação', tipo: 'nacional' });

    const id = post.body.data.id as number;

    const del = await request(app)
      .delete(`/api/v1/feriados/${id}`)
      .set('authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);

    const get = await request(app)
      .get('/api/v1/feriados')
      .set('authorization', `Bearer ${token}`);

    expect((get.body.data as Array<{ id: number }>).find((f) => f.id === id)).toBeUndefined();
  });

  it('404 — delete de id inexistente', async () => {
    const { token } = await criarSuperAdmin();
    const r = await request(buildApp())
      .delete('/api/v1/feriados/999999')
      .set('authorization', `Bearer ${token}`);

    expect(r.status).toBe(404);
  });
});
