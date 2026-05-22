import type { PrismaClient } from '@prisma/client';
import type { ValidarEscalaInput } from '@escalas/shared-schemas';
import { ConflictError, NotFoundError, HttpError } from '../utils/errors.js';
import { diasDoMes } from '../utils/calendario.js';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { auditService } from './audit.service.js';

function periodoDoMes(mes: number, ano: number): { date_start: string; date_end: string } {
  const dias = diasDoMes(mes, ano);
  return {
    date_start: dias[0]!.toISOString().slice(0, 10),
    date_end: dias[dias.length - 1]!.toISOString().slice(0, 10),
  };
}

export const validacaoService = {
  // Proxy do mapa de força do SISBOM, com lotação/período derivados da escala.
  async getMapaForca(escala_id: number, dateOverride: string | undefined, prisma: PrismaClient) {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
    if (!escala) throw new NotFoundError('Escala não encontrada.');
    const { date_start, date_end } = periodoDoMes(escala.mes, escala.ano);
    return sisbomClient.getMapaForca({
      lotacao: escala.lotacao_id,
      date: dateOverride ?? date_start,
      date_start,
      date_end,
    });
  },

  async validar(escala_id: number, input: ValidarEscalaInput, gestor_id: number, prisma: PrismaClient) {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
    if (!escala) throw new NotFoundError('Escala não encontrada.');
    if (escala.status !== 'em_validacao') {
      throw new ConflictError('A escala não está em validação.');
    }
    if (input.status === 'rejeitada' && !input.justificativa) {
      throw new HttpError(422, 'Justificativa é obrigatória ao rejeitar.');
    }

    const ultimaVersao = await prisma.escalaVersao.findFirst({
      where: { escala_id },
      orderBy: { versao: 'desc' },
    });
    if (!ultimaVersao) throw new ConflictError('Escala sem versão publicada.');

    // Congela o mapa de força no momento da validação (audit mesmo que o SISBOM mude).
    const mapa = await this.getMapaForca(escala_id, undefined, prisma);

    return prisma.$transaction(async (tx) => {
      const validacao = await tx.validacaoEscala.create({
        data: {
          escala_id,
          escala_versao_id: ultimaVersao.id,
          gestor_id,
          status: input.status,
          justificativa: input.justificativa ?? null,
          mapa_forca_snapshot: mapa as never,
        },
      });
      await tx.escala.update({ where: { id: escala_id }, data: { status: input.status } });
      await auditService.log(
        {
          user_id: gestor_id,
          acao: 'validar',
          entidade: 'Escala',
          entidade_id: escala_id,
          antes: { status: escala.status },
          depois: { status: input.status, validacao_id: validacao.id },
        },
        tx,
      );
      return validacao;
    });
  },

  async listarPendentes(lotacao_ids: number[] | undefined, prisma: PrismaClient) {
    return prisma.escala.findMany({
      where: {
        status: 'em_validacao',
        ...(lotacao_ids ? { lotacao_id: { in: lotacao_ids } } : {}),
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
  },

  async listarValidacoes(escala_id: number, prisma: PrismaClient) {
    return prisma.validacaoEscala.findMany({
      where: { escala_id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        escala_versao_id: true,
        gestor_id: true,
        status: true,
        justificativa: true,
        created_at: true,
      },
    });
  },
};
