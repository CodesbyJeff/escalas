import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma, resetDb } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

beforeEach(resetDb);

/**
 * cenario() cria:
 *   - Lotacao (id lotId)
 *   - Escala publicada
 *   - EscalaDia (2026-07-01)
 *   - EscalaGuarnicao
 *   - vagaComMilitar (militar_id = previsto.id)
 *   - vagaVago (militar_id = null)
 *   - fiscal (User + UserRole FISCAL na lotação)
 *   - gestor (User + UserRole GESTOR na lotação)
 */
async function cenario(lotId: number) {
  const lotacao = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: `Lotacao ${lotId}`, nivel: 3, operacional: true },
  });

  const previsto = await testPrisma.user.create({
    data: { cpf: `${lotId}0000001`, nome: 'Previsto', last_sync_at: new Date() },
  });
  const fiscal = await testPrisma.user.create({
    data: { cpf: `${lotId}0000002`, nome: 'Fiscal', last_sync_at: new Date() },
  });
  const gestor = await testPrisma.user.create({
    data: { cpf: `${lotId}0000003`, nome: 'Gestor', last_sync_at: new Date() },
  });
  const outro = await testPrisma.user.create({
    data: { cpf: `${lotId}0000004`, nome: 'SemPapel', last_sync_at: new Date() },
  });

  await testPrisma.userRole.create({
    data: { user_id: fiscal.id, role: 'FISCAL', lotacao_id: lotacao.id, created_by: fiscal.id },
  });
  await testPrisma.userRole.create({
    data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lotacao.id, created_by: gestor.id },
  });

  const escala = await testPrisma.escala.create({
    data: {
      lotacao_id: lotacao.id,
      mes: 7,
      ano: 2026,
      status: 'publicada',
      criado_por_id: fiscal.id,
      publicado_em: new Date(),
    },
  });

  const dia = await testPrisma.escalaDia.create({
    data: { escala_id: escala.id, data: new Date('2026-07-01T00:00:00.000Z') },
  });

  const guarnicao = await testPrisma.escalaGuarnicao.create({
    data: {
      escala_dia_id: dia.id,
      sigla: 'ABT-01',
      atividade: 'incendio',
      turno_inicio: '07:00',
      turno_fim: '19:00',
      ordem: 0,
    },
  });

  const vagaComMilitar = await testPrisma.vaga.create({
    data: {
      escala_guarnicao_id: guarnicao.id,
      funcao: 'comandante',
      militar_id: previsto.id,
      turno_inicio: '07:00',
      turno_fim: '19:00',
    },
  });

  const vagaVago = await testPrisma.vaga.create({
    data: {
      escala_guarnicao_id: guarnicao.id,
      funcao: 'motorista',
      militar_id: null,
      turno_inicio: '07:00',
      turno_fim: '19:00',
    },
  });

  return {
    lotacao,
    escala,
    dia,
    vagaComMilitar,
    vagaVago,
    fiscal,
    gestor,
    previsto,
    outro,
    tokenFiscal: signAccess({ user_id: fiscal.id, cpf: fiscal.cpf }),
    tokenGestor: signAccess({ user_id: gestor.id, cpf: gestor.cpf }),
    tokenOutro: signAccess({ user_id: outro.id, cpf: outro.cpf }),
  };
}

// ─── GET /:id/execucao/:data ────────────────────────────────────────────────

describe('GET /api/v1/escalas/:id/execucao/:data', () => {
  it('FISCAL → 200 com estrutura prevista + execucao null inicialmente', async () => {
    const c = await cenario(800);
    const r = await request(buildApp())
      .get(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);
    expect(r.status).toBe(200);
    expect(r.body.data.execucao_status).toBe('pendente');
    const vagas = r.body.data.guarnicoes.flatMap((g: { vagas: unknown[] }) => g.vagas);
    expect(vagas.every((v: { execucao: unknown }) => v.execucao === null)).toBe(true);
  });

  it('GESTOR → 200', async () => {
    const c = await cenario(801);
    const r = await request(buildApp())
      .get(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenGestor}`);
    expect(r.status).toBe(200);
  });

  it('usuário sem papel na lotação → 403', async () => {
    const c = await cenario(802);
    const r = await request(buildApp())
      .get(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenOutro}`);
    expect(r.status).toBe(403);
  });

  it('dia inexistente → 404', async () => {
    const c = await cenario(803);
    const r = await request(buildApp())
      .get(`/api/v1/escalas/${c.escala.id}/execucao/2099-12-31`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);
    expect(r.status).toBe(404);
  });
});

// ─── PUT /:id/execucao/:data ────────────────────────────────────────────────

describe('PUT /api/v1/escalas/:id/execucao/:data', () => {
  it('FISCAL salva situações → 200 e execucao populada', async () => {
    const c = await cenario(810);
    const r = await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [
          { vaga_id: c.vagaComMilitar.id, situacao: 'presente', militar_executado_id: c.previsto.id, do: false },
        ],
      });
    expect(r.status).toBe(200);
    const vagas = r.body.data.guarnicoes.flatMap((g: { vagas: unknown[] }) => g.vagas);
    const vaga = vagas.find((v: { id: number }) => v.id === c.vagaComMilitar.id) as { execucao: { situacao: string } | null };
    expect(vaga?.execucao?.situacao).toBe('presente');
  });

  it('vaga que não pertence ao dia → 422', async () => {
    const c = await cenario(811);
    const r = await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [{ vaga_id: 99999, situacao: 'presente', militar_executado_id: null, do: false }],
      });
    expect(r.status).toBe(422);
  });

  it('corpo Zod inválido (falta com militar_executado_id preenchido) → 422', async () => {
    const c = await cenario(812);
    const r = await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [
          { vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: c.previsto.id, do: false },
        ],
      });
    expect(r.status).toBe(422);
  });
});

// ─── POST /:id/execucao/:data/fechar ────────────────────────────────────────

describe('POST /api/v1/escalas/:id/execucao/:data/fechar', () => {
  it('FISCAL com todas previstas registradas → 200 e execucao_status="registrada"', async () => {
    const c = await cenario(820);
    // Primeiro salva a situação da vaga com militar
    await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }],
      });
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/fechar`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);
    expect(r.status).toBe(200);
    expect(r.body.data.execucao_status).toBe('registrada');
  });

  it('FISCAL com vagas previstas sem situação → 422', async () => {
    const c = await cenario(821);
    // Não salva nada, tenta fechar direto
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/fechar`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);
    expect(r.status).toBe(422);
  });
});

// ─── POST /:id/execucao/:data/validar ───────────────────────────────────────

describe('POST /api/v1/escalas/:id/execucao/:data/validar', () => {
  /** Helper: salva e fecha o dia para deixá-lo em "registrada" */
  async function deixarRegistrada(c: Awaited<ReturnType<typeof cenario>>) {
    await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }],
      });
    await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/fechar`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);
  }

  it('GESTOR valida → 200 e status "validada"', async () => {
    const c = await cenario(830);
    await deixarRegistrada(c);
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/validar`)
      .set('authorization', `Bearer ${c.tokenGestor}`)
      .send({ status: 'validada' });
    expect(r.status).toBe(200);
    expect(r.body.data.execucao_status).toBe('validada');
  });

  it('FISCAL tentando validar → 403', async () => {
    const c = await cenario(831);
    await deixarRegistrada(c);
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/validar`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({ status: 'validada' });
    expect(r.status).toBe(403);
  });

  it('rejeitar sem justificativa → 422', async () => {
    const c = await cenario(832);
    await deixarRegistrada(c);
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/validar`)
      .set('authorization', `Bearer ${c.tokenGestor}`)
      .send({ status: 'rejeitada' });
    expect(r.status).toBe(422);
  });

  it('dia não está "registrada" → 409', async () => {
    const c = await cenario(833);
    // Não fecha, tenta validar direto (status é pendente)
    const r = await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/validar`)
      .set('authorization', `Bearer ${c.tokenGestor}`)
      .send({ status: 'validada' });
    expect(r.status).toBe(409);
  });
});

// ─── GET /execucoes/pendentes/fiscal ────────────────────────────────────────

describe('GET /api/v1/execucoes/pendentes/fiscal', () => {
  it('FISCAL vê só pendências das suas lotações', async () => {
    const a = await cenario(840);
    const b = await cenario(841);

    // Ambos têm dias pendentes (padrão após criar)
    const r = await request(buildApp())
      .get('/api/v1/execucoes/pendentes/fiscal')
      .set('authorization', `Bearer ${a.tokenFiscal}`);
    expect(r.status).toBe(200);
    // fiscal de 840 só deve ver a lotação 840
    const lotacaoIds = r.body.data.map((x: { lotacao_id: number }) => x.lotacao_id);
    expect(lotacaoIds.every((id: number) => id === a.lotacao.id)).toBe(true);
    // não deve ver lotação 841
    expect(lotacaoIds.includes(b.lotacao.id)).toBe(false);
  });
});

// ─── GET /execucoes/pendentes/gestor ────────────────────────────────────────

describe('GET /api/v1/execucoes/pendentes/gestor', () => {
  it('GESTOR vê dias "registrada" da sua lotação', async () => {
    const c = await cenario(850);
    const outra = await cenario(851);

    // Fecha o dia da lotação c para ficar "registrada"
    await request(buildApp())
      .put(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01`)
      .set('authorization', `Bearer ${c.tokenFiscal}`)
      .send({
        vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }],
      });
    await request(buildApp())
      .post(`/api/v1/escalas/${c.escala.id}/execucao/2026-07-01/fechar`)
      .set('authorization', `Bearer ${c.tokenFiscal}`);

    const r = await request(buildApp())
      .get('/api/v1/execucoes/pendentes/gestor')
      .set('authorization', `Bearer ${c.tokenGestor}`);
    expect(r.status).toBe(200);
    expect(r.body.data.some((x: { data: string }) => x.data === '2026-07-01')).toBe(true);
    // não deve ver outra lotação
    const lotacaoIds = r.body.data.map((x: { lotacao_id: number }) => x.lotacao_id);
    expect(lotacaoIds.every((id: number) => id === c.lotacao.id)).toBe(true);
    expect(lotacaoIds.includes(outra.lotacao.id)).toBe(false);
  });
});
