import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 840, sigla: 'L840', nome: 'Lot 840', nivel: 3, operacional: true } });
  const gestor = await testPrisma.user.create({ data: { cpf: '84000000001', nome: 'Gestor', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
  const outro = await testPrisma.user.create({ data: { cpf: '84000000009', nome: 'Outro', last_sync_at: new Date() } });
  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: gestor.id, publicado_em: new Date() } });
  const dia = await testPrisma.escalaDia.create({ data: { escala_id: escala.id, data: new Date('2026-09-04T00:00:00.000Z') } });
  const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: gestor.id, turno_inicio: '07:00', turno_fim: '19:00' } });
  return {
    escala,
    tokenGestor: signAccess({ user_id: gestor.id, cpf: gestor.cpf }),
    tokenOutro: signAccess({ user_id: outro.id, cpf: outro.cpf }),
  };
}

describe('GET /api/v1/escalas/:id/resumo-servicos', () => {
  it('gestor da lotação obtém o resumo (200)', async () => {
    const { escala, tokenGestor } = await cenario();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/resumo-servicos`).set('authorization', `Bearer ${tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].semana).toBe(1);
    expect(r.body.data[0].fim_semana_feriado).toBe(0);
  });

  it('403 para quem não tem papel na lotação', async () => {
    const { escala, tokenOutro } = await cenario();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/resumo-servicos`).set('authorization', `Bearer ${tokenOutro}`);
    expect(r.status).toBe(403);
  });
});
