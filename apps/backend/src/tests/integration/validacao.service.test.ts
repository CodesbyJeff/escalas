import { describe, it, expect, afterEach } from 'vitest';
import nock from 'nock';
import { testPrisma } from '../helpers/db.js';
import { validacaoService } from '../../services/validacao.service.js';
import { env } from '../../config/env.js';

const ext = new URL(env.SISBOM_EXTERNAL_BASE_URL);
afterEach(() => nock.cleanAll());

function mockMapaForca() {
  nock(ext.origin)
    .get(ext.pathname + '/mapa-forca')
    .query(true)
    .reply(200, { militares: [{ _id: 'm1', _lotacao: 100 }], resumo: { totais: { total: 3 } } });
}

async function emValidacao(lotId: number, gestorCpf: string) {
  const lot = await testPrisma.lotacao.create({
    data: { id: lotId, sigla: `L${lotId}`, nome: 'Lot', nivel: 3, operacional: true },
  });
  const dono = await testPrisma.user.create({ data: { cpf: `100${lotId}`, nome: 'E', last_sync_at: new Date() } });
  const escala = await testPrisma.escala.create({
    data: { lotacao_id: lot.id, mes: 4, ano: 2026, criado_por_id: dono.id, status: 'em_validacao', publicado_em: new Date() },
  });
  const v1 = await testPrisma.escalaVersao.create({
    data: { escala_id: escala.id, versao: 1, publicado_por_id: dono.id, conteudo: {} },
  });
  const v2 = await testPrisma.escalaVersao.create({
    data: { escala_id: escala.id, versao: 2, publicado_por_id: dono.id, conteudo: {} },
  });
  const gestor = await testPrisma.user.create({ data: { cpf: gestorCpf, nome: 'G', last_sync_at: new Date() } });
  await testPrisma.userRole.create({ data: { user_id: gestor.id, role: 'GESTOR', lotacao_id: lot.id, created_by: gestor.id } });
  return { lot, dono, escala, v1, v2, gestor };
}

describe('validacaoService.validar', () => {
  it('aprova: muda status, grava snapshot, referencia a ÚLTIMA versão e audita', async () => {
    const { escala, v2, gestor } = await emValidacao(900, '90090090090');
    mockMapaForca();
    const val = await validacaoService.validar(escala.id, { status: 'aprovada' }, gestor.id, testPrisma);

    expect(val.status).toBe('aprovada');
    expect(val.escala_versao_id).toBe(v2.id);
    expect(val.mapa_forca_snapshot).toMatchObject({ militares: [{ _id: 'm1' }] });

    const atualizada = await testPrisma.escala.findUnique({ where: { id: escala.id } });
    expect(atualizada!.status).toBe('aprovada');

    const logs = await testPrisma.auditLog.findMany({ where: { entidade: 'Escala', entidade_id: escala.id, acao: 'validar' } });
    expect(logs).toHaveLength(1);
  });

  it('rejeita com justificativa: status rejeitada + justificativa gravada', async () => {
    const { escala, gestor } = await emValidacao(901, '91091091091');
    mockMapaForca();
    const val = await validacaoService.validar(escala.id, { status: 'rejeitada', justificativa: 'Efetivo insuficiente no fds.' }, gestor.id, testPrisma);
    expect(val.status).toBe('rejeitada');
    expect(val.justificativa).toBe('Efetivo insuficiente no fds.');
    const atualizada = await testPrisma.escala.findUnique({ where: { id: escala.id } });
    expect(atualizada!.status).toBe('rejeitada');
  });

  it('422 ao rejeitar sem justificativa', async () => {
    const { escala, gestor } = await emValidacao(902, '92092092092');
    await expect(
      validacaoService.validar(escala.id, { status: 'rejeitada' }, gestor.id, testPrisma),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('409 se a escala não está em_validacao', async () => {
    const { escala, gestor } = await emValidacao(903, '93093093093');
    await testPrisma.escala.update({ where: { id: escala.id }, data: { status: 'rascunho' } });
    await expect(
      validacaoService.validar(escala.id, { status: 'aprovada' }, gestor.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('404 se a escala não existe', async () => {
    await expect(
      validacaoService.validar(999999, { status: 'aprovada' }, 1, testPrisma),
    ).rejects.toMatchObject({ status: 404 });
  });
});
