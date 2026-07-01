import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

// ─── helpers ───────────────────────────────────────────────────────────────────

async function setup(lotId: number) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({
    data: { cpf: `GB${lotId}`, nome: 'Escalante', last_sync_at: new Date() },
  });
  await testPrisma.userRole.create({
    data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id },
  });
  const tmpl = await testPrisma.templateLotacao.create({
    data: {
      lotacao_id: lot.id,
      nome: 'Padrão',
      criado_por_id: esc.id,
      guarnicoes: {
        create: [{
          sigla: 'ABT-01', atividade: 'incendio',
          turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
          vagas_sugeridas: { create: [{ funcao: 'comandante', quantidade_sugerida: 1 }] },
        }],
      },
    },
  });
  const token = signAccess({ user_id: esc.id, cpf: esc.cpf });

  // Cria escala rascunho para o mês 2026-04 via API
  const r = await request(buildApp())
    .post('/api/v1/escalas')
    .set('authorization', `Bearer ${token}`)
    .send({ lotacao_id: lot.id, mes: 4, ano: 2026, template_id: tmpl.id });
  const escalaId = r.body.data.id as number;

  return { lot, esc, token, tmplId: tmpl.id, escalaId };
}

// ─── gerar-bloco ───────────────────────────────────────────────────────────────

describe('POST /api/v1/escalas/:id/gerar-bloco', () => {
  it('200 retorna dias_afetados', async () => {
    const { token, escalaId, tmplId } = await setup(920);
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/gerar-bloco`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-03', template_id: tmplId });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.dias_afetados).toBe(3);
  });

  it('403 sem papel ESCALANTE na escala', async () => {
    const { escalaId, tmplId } = await setup(921);
    const outro = await testPrisma.user.create({
      data: { cpf: 'GB921X', nome: 'Forasteiro', last_sync_at: new Date() },
    });
    const tokenOutro = signAccess({ user_id: outro.id, cpf: outro.cpf });
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/gerar-bloco`)
      .set('authorization', `Bearer ${tokenOutro}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-03', template_id: tmplId });
    expect(r.status).toBe(403);
  });

  it('422 intervalo fora do mês da escala', async () => {
    const { token, escalaId, tmplId } = await setup(922);
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/gerar-bloco`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-05-01', data_fim: '2026-05-03', template_id: tmplId });
    expect(r.status).toBe(422);
  });
});

// ─── repetir-ciclo ─────────────────────────────────────────────────────────────

describe('POST /api/v1/escalas/:id/repetir-ciclo', () => {
  it('200 repete ciclo e retorna dias_afetados', async () => {
    const { token, escalaId, tmplId } = await setup(923);

    // Primeiro carimba os dias do ciclo-fonte com o template
    await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/gerar-bloco`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-02', template_id: tmplId });

    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/repetir-ciclo`)
      .set('authorization', `Bearer ${token}`)
      .send({ ciclo_ini: '2026-04-01', ciclo_fim: '2026-04-02', ate: '2026-04-06' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.data.dias_afetados).toBe(4);
  });
});
