import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import nock from 'nock';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';
import { env } from '../../config/env.js';

const ext = new URL(env.SISBOM_EXTERNAL_BASE_URL);
afterEach(() => nock.cleanAll());

function mockMapaForca() {
  nock(ext.origin)
    .get(ext.pathname + '/mapa-forca')
    .query(true)
    .reply(200, { militares: [{ _id: 'm1', _lotacao: 100 }], resumo: { totais: { total: 1 } } });
}

// Escala em_validacao com 1 versão + um gestor e um escalante na lotação.
async function cenario(lotId: number) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'L', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({ data: { cpf: `100${lotId}`, nome: 'E', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
  const gestor = await testPrisma.user.create({ data: { cpf: `200${lotId}`, nome: 'G', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
  const escala = await testPrisma.escala.create({
    data: { lotacao_id: lot.id, mes: 4, ano: 2026, criado_por_id: esc.id, status: 'em_validacao', publicado_em: new Date() },
  });
  await testPrisma.escalaVersao.create({ data: { escala_id: escala.id, versao: 1, publicado_por_id: esc.id, conteudo: {} } });
  return {
    lot, escala,
    tokenEsc: signAccess({ user_id: esc.id, cpf: esc.cpf }),
    tokenGestor: signAccess({ user_id: gestor.id, cpf: gestor.cpf }),
  };
}

describe('GET /api/v1/validacoes/pendentes', () => {
  it('gestor vê só as escalas das lotações onde é gestor', async () => {
    const a = await cenario(920);
    await cenario(921); // outra lotação, outro gestor
    const r = await request(buildApp()).get('/api/v1/validacoes/pendentes').set('authorization', `Bearer ${a.tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].lotacao_id).toBe(a.lot.id);
  });
});

describe('POST /api/v1/escalas/:id/validar', () => {
  it('403 para o escalante (não é gestor da lotação)', async () => {
    const { escala, tokenEsc } = await cenario(922);
    const r = await request(buildApp()).post(`/api/v1/escalas/${escala.id}/validar`).set('authorization', `Bearer ${tokenEsc}`).send({ status: 'aprovada' });
    expect(r.status).toBe(403);
  });

  it('gestor aprova → 201 e status vira aprovada', async () => {
    const { escala, tokenGestor } = await cenario(923);
    mockMapaForca();
    const r = await request(buildApp()).post(`/api/v1/escalas/${escala.id}/validar`).set('authorization', `Bearer ${tokenGestor}`).send({ status: 'aprovada' });
    expect(r.status).toBe(201);
    const atualizada = await testPrisma.escala.findUnique({ where: { id: escala.id } });
    expect(atualizada!.status).toBe('aprovada');
  });

  it('422 ao rejeitar sem justificativa', async () => {
    const { escala, tokenGestor } = await cenario(924);
    const r = await request(buildApp()).post(`/api/v1/escalas/${escala.id}/validar`).set('authorization', `Bearer ${tokenGestor}`).send({ status: 'rejeitada' });
    expect(r.status).toBe(422);
  });

  it('409 quando a escala não está em_validacao', async () => {
    const { escala, tokenGestor } = await cenario(925);
    await testPrisma.escala.update({ where: { id: escala.id }, data: { status: 'rascunho' } });
    const r = await request(buildApp()).post(`/api/v1/escalas/${escala.id}/validar`).set('authorization', `Bearer ${tokenGestor}`).send({ status: 'aprovada' });
    expect(r.status).toBe(409);
  });
});

describe('GET /api/v1/escalas/:id/mapa-forca', () => {
  it('gestor obtém o mapa de força (proxy mockado)', async () => {
    const { escala, tokenGestor } = await cenario(926);
    mockMapaForca();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/mapa-forca`).set('authorization', `Bearer ${tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data.militares).toHaveLength(1);
  });
});

describe('GET /api/v1/escalas/:id/validacoes', () => {
  it('lista o histórico após uma validação', async () => {
    const { escala, tokenGestor } = await cenario(927);
    mockMapaForca();
    await request(buildApp()).post(`/api/v1/escalas/${escala.id}/validar`).set('authorization', `Bearer ${tokenGestor}`).send({ status: 'rejeitada', justificativa: 'ajustar' });
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/validacoes`).set('authorization', `Bearer ${tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].status).toBe('rejeitada');
  });
});
