import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function escalaDe(lotId: number) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const dono = await testPrisma.user.create({ data: { cpf: `100${lotId}`, nome: 'Esc', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: dono.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: dono.id } });
  await testPrisma.templateLotacao.create({
    data: { lotacao_id: lot.id, criado_por_id: dono.id, guarnicoes: { create: [{ sigla: 'A', atividade: 'i', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: { create: [{ funcao: 'c', quantidade_sugerida: 1 }] } }] } },
  });
  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 4, ano: 2026, criado_por_id: dono.id } });
  return { lot, dono, escala };
}

describe('requireEscalaAccess (via GET /escalas/:id)', () => {
  it('404 se a escala não existe', async () => {
    const { dono } = await escalaDe(860);
    const r = await request(buildApp()).get('/api/v1/escalas/999999').set('authorization', `Bearer ${signAccess({ user_id: dono.id, cpf: dono.cpf })}`);
    expect(r.status).toBe(404);
  });

  it('403 se o usuário não tem role na lotação da escala', async () => {
    const { escala } = await escalaDe(861);
    const outro = await testPrisma.user.create({ data: { cpf: '10101019999', nome: 'X', last_sync_at: new Date() } });
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}`).set('authorization', `Bearer ${signAccess({ user_id: outro.id, cpf: outro.cpf })}`);
    expect(r.status).toBe(403);
  });

  it('200 para o escalante da lotação', async () => {
    const { escala, dono } = await escalaDe(862);
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}`).set('authorization', `Bearer ${signAccess({ user_id: dono.id, cpf: dono.cpf })}`);
    expect(r.status).toBe(200);
  });

  it('200 para super-admin sem role', async () => {
    const { escala } = await escalaDe(863);
    const admin = await testPrisma.user.create({ data: { cpf: '10101018888', nome: 'SA', is_super_admin: true, last_sync_at: new Date() } });
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}`).set('authorization', `Bearer ${signAccess({ user_id: admin.id, cpf: admin.cpf })}`);
    expect(r.status).toBe(200);
  });

  it('200 para GESTOR da lotação (leitura)', async () => {
    const { escala, lot } = await escalaDe(864);
    const gestor = await testPrisma.user.create({ data: { cpf: '10101017777', nome: 'G', last_sync_at: new Date() } });
    await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}`).set('authorization', `Bearer ${signAccess({ user_id: gestor.id, cpf: gestor.cpf })}`);
    expect(r.status).toBe(200);
  });
});
