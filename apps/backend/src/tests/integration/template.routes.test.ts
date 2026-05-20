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
