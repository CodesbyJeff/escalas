import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';
import type { UpsertTemplateLotacaoInput } from '@escalas/shared-schemas';

async function setupBase(lotId: number) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const escalante = await testPrisma.user.create({
    data: { cpf: `100${lotId}`, nome: 'Escalante', last_sync_at: new Date() },
  });
  await testPrisma.userRole.create({
    data: { user_id: escalante.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: escalante.id },
  });
  const tokenEscalante = signAccess({ user_id: escalante.id, cpf: escalante.cpf });
  return { lot, escalante, tokenEscalante };
}

describe('GET /api/v1/templates/lotacao/:lotacao_id', () => {
  it('401 sem token', async () => {
    const r = await request(buildApp()).get('/api/v1/templates/lotacao/700');
    expect(r.status).toBe(401);
  });

  it('403 quando usuário não tem role na lotação', async () => {
    const { lot } = await setupBase(701);
    const outro = await testPrisma.user.create({
      data: { cpf: '90090090090', nome: 'Outro', last_sync_at: new Date() },
    });
    const token = signAccess({ user_id: outro.id, cpf: outro.cpf });
    const r = await request(buildApp())
      .get(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(403);
  });

  it('403 quando ESCALANTE de outra lotação tenta ler', async () => {
    const { tokenEscalante } = await setupBase(704); // ESCALANTE da 704
    const outraLot = await testPrisma.lotacao.create({
      data: { id: 705, sigla: 'L705', nome: 'Lot', nivel: 3, operacional: true },
    });
    const r = await request(buildApp())
      .get(`/api/v1/templates/lotacao/${outraLot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`);
    expect(r.status).toBe(403);
  });

  it('404 quando template não configurado', async () => {
    const { lot, tokenEscalante } = await setupBase(702);
    const r = await request(buildApp())
      .get(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`);
    expect(r.status).toBe(404);
    expect(r.body.success).toBe(false);
  });

  it('200 retorna template existente', async () => {
    const { lot, escalante, tokenEscalante } = await setupBase(703);
    await testPrisma.templateLotacao.create({
      data: {
        lotacao_id: lot.id,
        criado_por_id: escalante.id,
        guarnicoes: {
          create: [{
            sigla: 'ABT-01', atividade: 'incendio',
            turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
            vagas_sugeridas: { create: [{ funcao: 'comandante', quantidade_sugerida: 1 }] },
          }],
        },
      },
    });
    const r = await request(buildApp())
      .get(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`);
    expect(r.status).toBe(200);
    expect(r.body.data.guarnicoes).toHaveLength(1);
  });
});

const payloadValido: UpsertTemplateLotacaoInput = {
  guarnicoes: [{
    sigla: 'ABT-01', atividade: 'incendio',
    turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
    vagas_sugeridas: [{ funcao: 'comandante', quantidade_sugerida: 1 }],
  }],
};

describe('PUT /api/v1/templates/lotacao/:lotacao_id', () => {
  it('422 com payload inválido (turno mal-formatado)', async () => {
    const { lot, tokenEscalante } = await setupBase(710);
    const r = await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`)
      .send({
        guarnicoes: [{
          sigla: 'X', atividade: 'y',
          turno_padrao_inicio: '7am', turno_padrao_fim: '19:00', ordem: 0,
          vagas_sugeridas: [{ funcao: 'f', quantidade_sugerida: 1 }],
        }],
      });
    expect(r.status).toBe(422);
  });

  it('403 quando GESTOR tenta escrever', async () => {
    const { lot } = await setupBase(711);
    const gestor = await testPrisma.user.create({
      data: { cpf: '88800077766', nome: 'Gestor', last_sync_at: new Date() },
    });
    await testPrisma.userRole.create({
      data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id },
    });
    const token = signAccess({ user_id: gestor.id, cpf: gestor.cpf });
    const r = await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${token}`)
      .send(payloadValido);
    expect(r.status).toBe(403);
  });

  it('200 cria template novo', async () => {
    const { lot, tokenEscalante } = await setupBase(712);
    const r = await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`)
      .send(payloadValido);
    expect(r.status).toBe(200);
    expect(r.body.data.guarnicoes).toHaveLength(1);
  });

  it('200 substitui template existente (replace-all)', async () => {
    const { lot, tokenEscalante } = await setupBase(713);
    await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`)
      .send(payloadValido);

    const novo: UpsertTemplateLotacaoInput = {
      guarnicoes: [{
        sigla: 'AR-01', atividade: 'resgate',
        turno_padrao_inicio: '08:00', turno_padrao_fim: '20:00', ordem: 0,
        vagas_sugeridas: [{ funcao: 'socorrista', quantidade_sugerida: 2 }],
      }],
    };
    const r = await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${tokenEscalante}`)
      .send(novo);
    expect(r.status).toBe(200);
    expect(r.body.data.guarnicoes).toHaveLength(1);
    expect(r.body.data.guarnicoes[0].sigla).toBe('AR-01');
  });

  it('404 quando lotação não existe (super-admin passa pelo requireRole, mas service 404)', async () => {
    const admin = await testPrisma.user.create({
      data: { cpf: '77766655544', nome: 'A', is_super_admin: true, last_sync_at: new Date() },
    });
    const token = signAccess({ user_id: admin.id, cpf: admin.cpf });
    const r = await request(buildApp())
      .put(`/api/v1/templates/lotacao/99999`)
      .set('authorization', `Bearer ${token}`)
      .send(payloadValido);
    expect(r.status).toBe(404);
  });

  it('200 super-admin escreve e lê template em lotação sem ter role nela', async () => {
    const lot = await testPrisma.lotacao.create({
      data: { id: 714, sigla: 'L714', nome: 'Lot', nivel: 3, operacional: true },
    });
    const admin = await testPrisma.user.create({
      data: { cpf: '66655544433', nome: 'Super', is_super_admin: true, last_sync_at: new Date() },
    });
    const token = signAccess({ user_id: admin.id, cpf: admin.cpf });

    const put = await request(buildApp())
      .put(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${token}`)
      .send(payloadValido);
    expect(put.status).toBe(200);

    const get = await request(buildApp())
      .get(`/api/v1/templates/lotacao/${lot.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.data.guarnicoes).toHaveLength(1);
  });
});
