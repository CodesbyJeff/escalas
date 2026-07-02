import type { PrismaClient } from '@prisma/client';
import type { CriarFuncaoPatenteInput, AtualizarFuncaoPatenteInput } from '@escalas/shared-schemas';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { normalizeFuncao } from '../utils/funcao.js';

export const funcaoPatenteService = {
  // lotacao_id undefined → lista as globais; número → as daquela lotação. (Layout fica no 2b.2.)
  async listar(lotacao_id: number | undefined, prisma: PrismaClient) {
    return prisma.funcaoPatente.findMany({
      where: { template_id: null, lotacao_id: lotacao_id ?? null },
      orderBy: { funcao_norm: 'asc' },
    });
  },

  async criar(input: CriarFuncaoPatenteInput, prisma: PrismaClient) {
    const lotacao_id = input.lotacao_id ?? null;
    const funcao_norm = normalizeFuncao(input.funcao);
    const existe = await prisma.funcaoPatente.findFirst({ where: { lotacao_id, template_id: null, funcao_norm } });
    if (existe) throw new ConflictError('Já existe regra para essa função neste escopo.');
    return prisma.funcaoPatente.create({
      data: { lotacao_id, template_id: null, funcao_norm, patente_ids: input.patente_ids },
    });
  },

  async atualizar(id: number, input: AtualizarFuncaoPatenteInput, prisma: PrismaClient) {
    const existe = await prisma.funcaoPatente.findUnique({ where: { id } });
    if (!existe) throw new NotFoundError('Regra não encontrada.');
    return prisma.funcaoPatente.update({ where: { id }, data: { patente_ids: input.patente_ids } });
  },

  async remover(id: number, prisma: PrismaClient) {
    const existe = await prisma.funcaoPatente.findUnique({ where: { id } });
    if (!existe) throw new NotFoundError('Regra não encontrada.');
    await prisma.funcaoPatente.delete({ where: { id } });
  },
};
