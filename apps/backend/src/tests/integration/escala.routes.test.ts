import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

// ────────────────────────────────────────────────────────────────────────────
// Helpers reutilizados pelos describes abaixo
// ────────────────────────────────────────────────────────────────────────────

async function setup(lotId: number) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({ data: { cpf: `100${lotId}`, nome: 'Esc', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
  await testPrisma.templateLotacao.create({
    data: { lotacao_id: lot.id, criado_por_id: esc.id, guarnicoes: { create: [{ sigla: 'ABT-01', atividade: 'incendio', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: { create: [{ funcao: 'comandante', quantidade_sugerida: 1 }] } }] } },
  });
  const token = signAccess({ user_id: esc.id, cpf: esc.cpf });
  return { lot, esc, token };
}

describe('POST /api/v1/escalas', () => {
  it('403 sem role de escalante na lotação', async () => {
    const { lot } = await setup(870);
    const outro = await testPrisma.user.create({ data: { cpf: '20202029999', nome: 'X', last_sync_at: new Date() } });
    const r = await request(buildApp()).post('/api/v1/escalas')
      .set('authorization', `Bearer ${signAccess({ user_id: outro.id, cpf: outro.cpf })}`)
      .send({ lotacao_id: lot.id, mes: 4, ano: 2026 });
    expect(r.status).toBe(403);
  });

  it('201 cria escala e gera dias', async () => {
    const { lot, token } = await setup(871);
    const r = await request(buildApp()).post('/api/v1/escalas')
      .set('authorization', `Bearer ${token}`)
      .send({ lotacao_id: lot.id, mes: 4, ano: 2026 });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('rascunho');
  });

  it('409 sem template', async () => {
    const lot = await testPrisma.lotacao.create({ data: { id: 872, sigla: 'L872', nome: 'L', nivel: 3, operacional: true } });
    const esc = await testPrisma.user.create({ data: { cpf: '100872', nome: 'E', last_sync_at: new Date() } });
    await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
    const r = await request(buildApp()).post('/api/v1/escalas')
      .set('authorization', `Bearer ${signAccess({ user_id: esc.id, cpf: esc.cpf })}`)
      .send({ lotacao_id: lot.id, mes: 4, ano: 2026 });
    expect(r.status).toBe(409);
  });
});

describe('GET escopo + mes + PUT dia', () => {
  async function comEscala(lotId: number) {
    const s = await setup(lotId);
    const r = await request(buildApp()).post('/api/v1/escalas').set('authorization', `Bearer ${s.token}`).send({ lotacao_id: s.lot.id, mes: 4, ano: 2026 });
    return { ...s, escalaId: r.body.data.id as number };
  }

  it('listar só retorna escalas das lotações do escalante', async () => {
    const a = await comEscala(875); // escalante A, lotação 875
    await comEscala(876);            // escalante B, lotação 876 (outro dono)
    const r = await request(buildApp()).get('/api/v1/escalas').set('authorization', `Bearer ${a.token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].lotacao_id).toBe(a.lot.id);
  });

  it('GET /:id/mes resume os dias', async () => {
    const { token, escalaId } = await comEscala(873);
    const r = await request(buildApp()).get(`/api/v1/escalas/${escalaId}/mes`).set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.dias).toHaveLength(30);
  });

  it('PUT dia salva e 422 em conflito', async () => {
    const { token, escalaId } = await comEscala(874);
    const militar = await testPrisma.user.create({ data: { cpf: '20202028888', nome: 'M', last_sync_at: new Date() } });
    const okR = await request(buildApp()).put(`/api/v1/escalas/${escalaId}/dias/2026-04-01`).set('authorization', `Bearer ${token}`)
      .send({ guarnicoes: [{ sigla: 'ABT-01', atividade: 'incendio', viatura_id: null, turno_inicio: '07:00', turno_fim: '19:00', ordem: 0, vagas: [{ funcao: 'comandante', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' }] }] });
    expect(okR.status).toBe(200);

    const conflR = await request(buildApp()).put(`/api/v1/escalas/${escalaId}/dias/2026-04-02`).set('authorization', `Bearer ${token}`)
      .send({ guarnicoes: [{ sigla: 'ABT-01', atividade: 'incendio', viatura_id: null, turno_inicio: '07:00', turno_fim: '19:00', ordem: 0, vagas: [
        { funcao: 'comandante', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' },
        { funcao: 'motorista', militar_id: militar.id, turno_inicio: '12:00', turno_fim: '15:00' },
      ] }] });
    expect(conflR.status).toBe(422);
    expect(conflR.body.data.conflitos).toBeDefined();
  });
});

describe('publicar / versões / deletar', () => {
  async function comEscala(lotId: number) {
    const lot = await testPrisma.lotacao.create({ data: { id: lotId, sigla: `L${lotId}`, nome: 'L', nivel: 3, operacional: true } });
    const esc = await testPrisma.user.create({ data: { cpf: `100${lotId}`, nome: 'E', last_sync_at: new Date() } });
    await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
    await testPrisma.templateLotacao.create({ data: { lotacao_id: lot.id, criado_por_id: esc.id, guarnicoes: { create: [{ sigla: 'A', atividade: 'i', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: { create: [{ funcao: 'c', quantidade_sugerida: 1 }] } }] } } });
    const token = signAccess({ user_id: esc.id, cpf: esc.cpf });
    const r = await request(buildApp()).post('/api/v1/escalas').set('authorization', `Bearer ${token}`).send({ lotacao_id: lot.id, mes: 4, ano: 2026 });
    return { token, escalaId: r.body.data.id as number };
  }

  it('publicar cria versão e GET /versoes lista', async () => {
    const { token, escalaId } = await comEscala(880);
    const pub = await request(buildApp()).post(`/api/v1/escalas/${escalaId}/publicar`).set('authorization', `Bearer ${token}`);
    expect(pub.status).toBe(201);
    expect(pub.body.data.versao).toBe(1);

    const lista = await request(buildApp()).get(`/api/v1/escalas/${escalaId}/versoes`).set('authorization', `Bearer ${token}`);
    expect(lista.status).toBe(200);
    expect(lista.body.data).toHaveLength(1);
  });

  it('409 ao deletar escala publicada; 200 em rascunho', async () => {
    const { token, escalaId } = await comEscala(881);
    await request(buildApp()).post(`/api/v1/escalas/${escalaId}/publicar`).set('authorization', `Bearer ${token}`);
    const del = await request(buildApp()).delete(`/api/v1/escalas/${escalaId}`).set('authorization', `Bearer ${token}`);
    expect(del.status).toBe(409);

    const { token: t2, escalaId: id2 } = await comEscala(882);
    const del2 = await request(buildApp()).delete(`/api/v1/escalas/${id2}`).set('authorization', `Bearer ${t2}`);
    expect(del2.status).toBe(200);
  });
});

describe('GET /api/v1/escalas/:id/militares', () => {
  async function setupMilitares(lotId: number) {
    // Lotação
    const lot = await testPrisma.lotacao.create({
      data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot Militares', nivel: 3, operacional: true },
    });

    // Escalante com role ESCALANTE na lotação
    const escalante = await testPrisma.user.create({
      data: { cpf: `ESC${lotId}`, nome: 'Escalante', last_sync_at: new Date() },
    });
    await testPrisma.userRole.create({
      data: { user_id: escalante.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: escalante.id },
    });

    // Template mínimo para criar a escala via POST
    await testPrisma.templateLotacao.create({
      data: {
        lotacao_id: lot.id,
        criado_por_id: escalante.id,
        guarnicoes: {
          create: [{
            sigla: 'ABT-01',
            atividade: 'incendio',
            turno_padrao_inicio: '07:00',
            turno_padrao_fim: '19:00',
            ordem: 0,
            vagas_sugeridas: { create: [{ funcao: 'comandante', quantidade_sugerida: 1 }] },
          }],
        },
      },
    });

    // Dois militares vinculados à lotação via UserLotacao
    const anaPaula = await testPrisma.user.create({
      data: { cpf: `ANA${lotId}`, nome: 'Ana Paula', last_sync_at: new Date(), ativo: true },
    });
    await testPrisma.userLotacao.create({ data: { user_id: anaPaula.id, lotacao_id: lot.id, nivel: 3 } });

    const bruno = await testPrisma.user.create({
      data: { cpf: `BRU${lotId}`, nome: 'Bruno', last_sync_at: new Date(), ativo: true },
    });
    await testPrisma.userLotacao.create({ data: { user_id: bruno.id, lotacao_id: lot.id, nivel: 3 } });

    // Forasteiro sem nenhuma role na lotação
    const forasteiro = await testPrisma.user.create({
      data: { cpf: `FOR${lotId}`, nome: 'Forasteiro', last_sync_at: new Date() },
    });

    // Cria a escala via service (POST)
    const token = signAccess({ user_id: escalante.id, cpf: escalante.cpf });
    const r = await request(buildApp())
      .post('/api/v1/escalas')
      .set('authorization', `Bearer ${token}`)
      .send({ lotacao_id: lot.id, mes: 4, ano: 2026 });
    const escalaId = r.body.data.id as number;

    return { lot, escalante, anaPaula, bruno, forasteiro, escalaId, token };
  }

  it('lista militares da lotação da escala (ESCALANTE) e filtra por busca', async () => {
    const { escalante, anaPaula, bruno, escalaId, token } = await setupMilitares(890);

    // Sem filtro: deve retornar todos militares da lotação
    const resAll = await request(buildApp())
      .get(`/api/v1/escalas/${escalaId}/militares`)
      .set('Authorization', `Bearer ${token}`);
    expect(resAll.status).toBe(200);
    expect(resAll.body.success).toBe(true);
    expect(resAll.body.data.map((m: { nome: string }) => m.nome)).toEqual(
      expect.arrayContaining([anaPaula.nome, bruno.nome]),
    );
    expect(resAll.body.data[0]).toHaveProperty('posto');
    expect(resAll.body.data[0]).not.toHaveProperty('cpf');
    expect(resAll.body.data[0]).not.toHaveProperty('senha_hash');

    // Com filtro: só Ana Paula
    const resBusca = await request(buildApp())
      .get(`/api/v1/escalas/${escalaId}/militares?busca=Ana`)
      .set('Authorization', `Bearer ${token}`);
    expect(resBusca.body.data).toHaveLength(1);
    expect(resBusca.body.data[0].nome).toBe('Ana Paula');
  });

  it('403 para usuário sem papel na lotação da escala', async () => {
    const { forasteiro, escalaId } = await setupMilitares(891);
    const token = signAccess({ user_id: forasteiro.id, cpf: forasteiro.cpf });
    const res = await request(buildApp())
      .get(`/api/v1/escalas/${escalaId}/militares`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
