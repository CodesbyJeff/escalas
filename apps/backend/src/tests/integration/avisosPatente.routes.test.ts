import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma, resetDb } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function seedPatentes() {
  await testPrisma.patente.createMany({
    data: [
      { id: 12, forca_id: 1, sigla: 'CAP', nome: 'Capitão', ordem: 5 },
      { id: 17, forca_id: 1, sigla: 'SD', nome: 'Soldado', ordem: 12 },
    ],
  });
}

async function cenario() {
  await seedPatentes();
  await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });

  const lot = await testPrisma.lotacao.create({ data: { id: 850, sigla: 'L850', nome: 'Lot 850', nivel: 3, operacional: true } });
  const gestor = await testPrisma.user.create({ data: { cpf: '85000000001', nome: 'Gestor', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });

  const militarOk = await testPrisma.user.create({ data: { cpf: '85000000002', nome: 'Militar Ok', patente_id: 12, last_sync_at: new Date() } });
  const militarDivergente = await testPrisma.user.create({ data: { cpf: '85000000003', nome: 'Militar Divergente', patente_id: 17, last_sync_at: new Date() } });

  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: gestor.id, publicado_em: new Date() } });
  const dia = await testPrisma.escalaDia.create({ data: { escala_id: escala.id, data: new Date('2026-09-04T00:00:00.000Z') } });
  const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Comandante', militar_id: militarDivergente.id, turno_inicio: '07:00', turno_fim: '19:00' } });
  await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Comandante', militar_id: militarOk.id, turno_inicio: '07:00', turno_fim: '19:00' } });

  return {
    escala,
    lot,
    gestor,
    tokenGestor: signAccess({ user_id: gestor.id, cpf: gestor.cpf }),
  };
}

describe('GET /api/v1/escalas/:id/avisos-patente', () => {
  beforeEach(async () => { await resetDb(); });

  it('retorna apenas a vaga com patente divergente', async () => {
    const { escala, tokenGestor } = await cenario();
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/avisos-patente`).set('authorization', `Bearer ${tokenGestor}`);

    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].funcao).toBe('Comandante');
    expect(r.body.data[0].militar_nome).toBe('Militar Divergente');
    expect(r.body.data[0].patentes_esperadas).toEqual([12]);
    expect(r.body.data[0].data).toBe('2026-09-04');
  });

  it('escala sem divergências retorna lista vazia', async () => {
    await seedPatentes();
    await testPrisma.funcaoPatente.create({ data: { funcao_norm: 'COMANDANTE', patente_ids: [12] } });

    const lot = await testPrisma.lotacao.create({ data: { id: 851, sigla: 'L851', nome: 'Lot 851', nivel: 3, operacional: true } });
    const gestor = await testPrisma.user.create({ data: { cpf: '85100000001', nome: 'Gestor', last_sync_at: new Date() } });
    await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
    const militarOk = await testPrisma.user.create({ data: { cpf: '85100000002', nome: 'Militar Ok', patente_id: 12, last_sync_at: new Date() } });

    const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: gestor.id, publicado_em: new Date() } });
    const dia = await testPrisma.escalaDia.create({ data: { escala_id: escala.id, data: new Date('2026-09-05T00:00:00.000Z') } });
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'Comandante', militar_id: militarOk.id, turno_inicio: '07:00', turno_fim: '19:00' } });

    const tokenGestor = signAccess({ user_id: gestor.id, cpf: gestor.cpf });
    const r = await request(buildApp()).get(`/api/v1/escalas/${escala.id}/avisos-patente`).set('authorization', `Bearer ${tokenGestor}`);

    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
  });
});
