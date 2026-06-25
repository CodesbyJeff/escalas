import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { execucaoService as svc } from '../../services/execucao.service.js';

beforeEach(resetDb);

/**
 * cenario() cria:
 *   - Lotacao (id 700)
 *   - Escala (publicada)
 *   - EscalaDia (2026-07-01)
 *   - EscalaGuarnicao
 *   - vagaComMilitar  (militar_id = previsto.id)
 *   - vagaVago        (militar_id = null)
 *   - fiscal (User)
 *   - previsto (User — militar previsto na vaga)
 *   - substituto (User)
 *   - gestor (User)
 */
async function cenario() {
  const lotacao = await testPrisma.lotacao.create({
    data: { id: 700, sigla: 'LOT700', nome: 'Lotação Teste', nivel: 3, operacional: true },
  });

  const fiscal = await testPrisma.user.create({
    data: { cpf: '70000000001', nome: 'Fiscal', last_sync_at: new Date() },
  });
  const previsto = await testPrisma.user.create({
    data: { cpf: '70000000002', nome: 'Previsto', last_sync_at: new Date() },
  });
  const substituto = await testPrisma.user.create({
    data: { cpf: '70000000003', nome: 'Substituto', last_sync_at: new Date() },
  });
  const gestor = await testPrisma.user.create({
    data: { cpf: '70000000004', nome: 'Gestor', last_sync_at: new Date() },
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
    data: {
      escala_id: escala.id,
      data: new Date('2026-07-01T00:00:00.000Z'),
    },
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

  return { escala, dia, vagaComMilitar, vagaVago, fiscal, previsto, substituto, gestor, lotacao };
}

describe('execucaoService', () => {
  it('getDia retorna prevista + execucao null inicialmente', async () => {
    const c = await cenario();
    const dto = await svc.getDia(c.escala.id, '2026-07-01', testPrisma);
    expect(dto.execucao_status).toBe('pendente');
    const vagas = dto.guarnicoes.flatMap((g) => g.vagas);
    expect(vagas.every((v) => v.execucao === null)).toBe(true);
  });

  it('getDia 404 quando dia não existe', async () => {
    const c = await cenario();
    await expect(svc.getDia(c.escala.id, '2026-08-01', testPrisma)).rejects.toMatchObject({ status: 404 });
  });

  it('salvar faz upsert das ExecucaoVaga e mantém status pendente', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      {
        vagas: [
          { vaga_id: c.vagaComMilitar.id, situacao: 'presente', militar_executado_id: c.previsto.id, do: false },
        ],
      },
      c.fiscal.id,
      testPrisma,
    );
    const dto = await svc.getDia(c.escala.id, '2026-07-01', testPrisma);
    const v = dto.guarnicoes[0]!.vagas.find((x) => x.id === c.vagaComMilitar.id)!;
    expect(v.execucao?.situacao).toBe('presente');
    expect(dto.execucao_status).toBe('pendente');
  });

  it('salvar 422 quando vaga não pertence ao dia', async () => {
    const c = await cenario();
    await expect(
      svc.salvar(
        c.escala.id,
        '2026-07-01',
        { vagas: [{ vaga_id: 99999, situacao: 'presente', militar_executado_id: null, do: false }] },
        c.fiscal.id,
        testPrisma,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('fechar exige situacao p/ toda vaga com militar previsto; vai p/ registrada', async () => {
    const c = await cenario();
    // sem registrar nada → fechar deve falhar (vaga com militar sem execução)
    await expect(svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma)).rejects.toThrow();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      {
        vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }],
      },
      c.fiscal.id,
      testPrisma,
    );
    const dto = await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    expect(dto.execucao_status).toBe('registrada');
  });

  it('fechar 409 se dia já está registrada', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      { vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }] },
      c.fiscal.id,
      testPrisma,
    );
    await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    await expect(svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma)).rejects.toMatchObject({ status: 409 });
  });

  it('validar aprovado → validada', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      {
        vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'presente', militar_executado_id: c.previsto.id, do: false }],
      },
      c.fiscal.id,
      testPrisma,
    );
    await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    const ok = await svc.validar(c.escala.id, '2026-07-01', { status: 'validada' }, c.gestor.id, testPrisma);
    expect(ok.execucao_status).toBe('validada');
  });

  it('validar rejeitado sem justificativa lança 422', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      { vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }] },
      c.fiscal.id,
      testPrisma,
    );
    await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    await expect(
      svc.validar(c.escala.id, '2026-07-01', { status: 'rejeitada' }, c.gestor.id, testPrisma),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('validar rejeitado com justificativa → volta para rejeitada', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      { vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }] },
      c.fiscal.id,
      testPrisma,
    );
    await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    const rej = await svc.validar(
      c.escala.id,
      '2026-07-01',
      { status: 'rejeitada', justificativa: 'Dados incorretos.' },
      c.gestor.id,
      testPrisma,
    );
    expect(rej.execucao_status).toBe('rejeitada');
    expect(rej.justificativa).toBe('Dados incorretos.');
  });

  it('validar 409 se dia não está registrada', async () => {
    const c = await cenario();
    await expect(
      svc.validar(c.escala.id, '2026-07-01', { status: 'validada' }, c.gestor.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('listarPendentesFiscal escopa por lotação e status pendente/rejeitada e data<=hoje', async () => {
    const c = await cenario();
    const lista = await svc.listarPendentesFiscal([c.lotacao.id], '2999-12-31', testPrisma);
    expect(lista.some((x) => x.data === '2026-07-01')).toBe(true);
  });

  it('listarPendentesFiscal não inclui dias de outra lotação', async () => {
    await cenario();
    const lista = await svc.listarPendentesFiscal([9999], '2999-12-31', testPrisma);
    expect(lista.some((x) => x.data === '2026-07-01')).toBe(false);
  });

  it('listarPendentesGestor retorna dias com status registrada', async () => {
    const c = await cenario();
    await svc.salvar(
      c.escala.id,
      '2026-07-01',
      { vagas: [{ vaga_id: c.vagaComMilitar.id, situacao: 'falta', militar_executado_id: null, do: false }] },
      c.fiscal.id,
      testPrisma,
    );
    await svc.fechar(c.escala.id, '2026-07-01', c.fiscal.id, testPrisma);
    const lista = await svc.listarPendentesGestor([c.lotacao.id], testPrisma);
    expect(lista.some((x) => x.data === '2026-07-01')).toBe(true);
  });
});
