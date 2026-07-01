import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 910, sigla: 'L910', nome: 'L', nivel: 3, operacional: true } });
  const esc = await testPrisma.user.create({ data: { cpf: '91000000001', nome: 'Esc', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id } });
  const outro = await testPrisma.user.create({ data: { cpf: '91000000009', nome: 'Outro', last_sync_at: new Date() } });
  return { lot, tokenEsc: signAccess({ user_id: esc.id, cpf: esc.cpf }), tokenOutro: signAccess({ user_id: outro.id, cpf: outro.cpf }) };
}
const body = { nome: 'Dia Útil', guarnicoes: [{ sigla: 'ABT', atividade: 'Inc', turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0, vagas_sugeridas: [{ funcao: 'Cmt', quantidade_sugerida: 1 }] }] };

describe('Layouts REST', () => {
  it('escalante cria, lista e obtém layout', async () => {
    const { lot, tokenEsc } = await cenario();
    const c = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    expect(c.status).toBe(201);
    const id = c.body.data.id;
    const l = await request(buildApp()).get(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`);
    expect(l.body.data).toHaveLength(1);
    const g = await request(buildApp()).get(`/api/v1/templates/${id}`).set('authorization', `Bearer ${tokenEsc}`);
    expect(g.body.data.nome).toBe('Dia Útil');
  });
  it('403 para quem não é escalante da lotação (criar)', async () => {
    const { lot, tokenOutro } = await cenario();
    const r = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenOutro}`).send(body);
    expect(r.status).toBe(403);
  });
  it('nome duplicado → 409', async () => {
    const { lot, tokenEsc } = await cenario();
    await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    const dup = await request(buildApp()).post(`/api/v1/templates/lotacao/${lot.id}`).set('authorization', `Bearer ${tokenEsc}`).send(body);
    expect(dup.status).toBe(409);
  });
});
