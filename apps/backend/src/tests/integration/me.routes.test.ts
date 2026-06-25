// apps/backend/src/tests/integration/me.routes.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 810, sigla: 'L810', nome: 'Lot 810', nivel: 3, operacional: true } });
  const militar = await testPrisma.user.create({ data: { cpf: '81000000001', nome: 'Militar', last_sync_at: new Date() } });
  const esc = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 7, ano: 2026, status: 'publicada', criado_por_id: militar.id, publicado_em: new Date() } });
  const dia = await testPrisma.escalaDia.create({ data: { escala_id: esc.id, data: new Date('2026-07-15T00:00:00.000Z') } });
  const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'UR-01', atividade: 'APH', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Socorrista', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' } });
  return { militar, token: signAccess({ user_id: militar.id, cpf: militar.cpf }) };
}

describe('GET /api/v1/me/servicos', () => {
  it('401 sem token', async () => {
    const r = await request(buildApp()).get('/api/v1/me/servicos');
    expect(r.status).toBe(401);
  });

  it('lista os serviços do militar autenticado dentro da faixa', async () => {
    const { token } = await cenario();
    const r = await request(buildApp()).get('/api/v1/me/servicos?from=2026-07-01&to=2026-07-31').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].funcao).toBe('Socorrista');
    expect(r.body.data[0].data).toBe('2026-07-15');
  });

  it('422 quando to < from', async () => {
    const { token } = await cenario();
    const r = await request(buildApp()).get('/api/v1/me/servicos?from=2026-07-31&to=2026-07-01').set('authorization', `Bearer ${token}`);
    expect(r.status).toBe(422);
  });
});
