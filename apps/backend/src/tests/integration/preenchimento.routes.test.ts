import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { testPrisma, resetDb } from '../helpers/db.js';
import { signAccess } from '../../config/jwt.js';

// ─── helpers ───────────────────────────────────────────────────────────────────

async function cenario(lotId = 930) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const esc = await testPrisma.user.create({
    data: { cpf: `PR${lotId}0`, nome: 'Escalante', last_sync_at: new Date() },
  });
  await testPrisma.userRole.create({
    data: { user_id: esc.id, role: 'ESCALANTE', lotacao_id: lot.id, created_by: esc.id },
  });

  const militares = await Promise.all(
    [1, 2, 3].map((n) =>
      testPrisma.user.create({
        data: { cpf: `PR${lotId}${n}`, nome: `Militar ${n}`, last_sync_at: new Date() },
      }),
    ),
  );
  // vincula os militares à lotação (necessário para adminService.listarUsuarios filtrar por lotacao_id)
  await Promise.all(
    militares.map((m) =>
      testPrisma.userLotacao.create({ data: { user_id: m.id, lotacao_id: lot.id, nivel: 3 } }),
    ),
  );

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

  const r = await request(buildApp())
    .post('/api/v1/escalas')
    .set('authorization', `Bearer ${token}`)
    .send({ lotacao_id: lot.id, mes: 4, ano: 2026, template_id: tmpl.id });
  const escalaId = r.body.data.id as number;

  await request(buildApp())
    .post(`/api/v1/escalas/${escalaId}/gerar-bloco`)
    .set('authorization', `Bearer ${token}`)
    .send({ data_ini: '2026-04-01', data_fim: '2026-04-02', template_id: tmpl.id });

  return { lot, esc, token, tmpl, escalaId, militares };
}

// Nota: escalaService.criar já cria EscalaDia+guarnicoes/vagas para TODOS os dias do mês
// (a partir do template). gerar-bloco só recarimba os dias do intervalo pedido. Por isso,
// aqui filtramos explicitamente pelo intervalo 2026-04-01..02 usado nos testes.
async function vagasDoIntervalo(escalaId: number) {
  const todas = await testPrisma.vaga.findMany({
    where: { guarnicao: { dia: { escala_id: escalaId } } },
    include: { guarnicao: { include: { dia: true } } },
  });
  return todas.filter((v) => {
    const d = v.guarnicao.dia.data.toISOString().slice(0, 10);
    return d === '2026-04-01' || d === '2026-04-02';
  });
}

// ─── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/escalas/:id/sugerir-preenchimento e /aplicar-preenchimento', () => {
  beforeEach(async () => { await resetDb(); });

  it('sugerir: preenche vagas abertas sem conflito de turno e NÃO grava', async () => {
    const { token, escalaId } = await cenario(930);

    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/sugerir-preenchimento`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-02' });

    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2); // 1 vaga por dia (2 dias carimbados)
    for (const item of r.body.data) {
      expect(item.militar_id).not.toBeNull();
    }
    // não persiste: mesmo militar não pode ter sido escalado nos 2 turnos do mesmo dia via sugerir
    const vagas = await vagasDoIntervalo(escalaId);
    expect(vagas.every((v) => v.militar_id === null)).toBe(true);
  });

  it('aplicar: persiste nas vagas abertas e não sobrescreve preenchimento manual', async () => {
    const { token, escalaId, militares } = await cenario(931);

    // preenche manualmente a vaga do dia 1 antes de aplicar
    const vagasAntes = await vagasDoIntervalo(escalaId);
    const vagaDia1 = vagasAntes.find((v) => v.guarnicao.dia.data.toISOString().slice(0, 10) === '2026-04-01')!;
    await testPrisma.vaga.update({ where: { id: vagaDia1.id }, data: { militar_id: militares[0]!.id } });

    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/aplicar-preenchimento`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-02' });

    expect(r.status).toBe(200);
    expect(r.body.data.vagas_preenchidas).toBeGreaterThan(0);

    const vagasDepois = await vagasDoIntervalo(escalaId);
    expect(vagasDepois.every((v) => v.militar_id !== null)).toBe(true);
    // a vaga preenchida manualmente continua com o militar original (não sobrescrita)
    const vagaDia1Depois = vagasDepois.find((v) => v.id === vagaDia1.id)!;
    expect(vagaDia1Depois.militar_id).toBe(militares[0]!.id);

    // reaplicar não deve preencher nada de novo (todas as vagas já estão ocupadas)
    const r2 = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/aplicar-preenchimento`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-02' });
    expect(r2.status).toBe(200);
    expect(r2.body.data.vagas_preenchidas).toBe(0);
  });

  it('409 quando a escala não está em rascunho', async () => {
    const { token, escalaId } = await cenario(932);
    await testPrisma.escala.update({ where: { id: escalaId }, data: { status: 'publicada' } });

    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/sugerir-preenchimento`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-04-01', data_fim: '2026-04-02' });

    expect(r.status).toBe(409);
  });

  it('422 quando o intervalo está fora do mês da escala', async () => {
    const { token, escalaId } = await cenario(933);

    const r = await request(buildApp())
      .post(`/api/v1/escalas/${escalaId}/aplicar-preenchimento`)
      .set('authorization', `Bearer ${token}`)
      .send({ data_ini: '2026-05-01', data_fim: '2026-05-02' });

    expect(r.status).toBe(422);
  });
});
