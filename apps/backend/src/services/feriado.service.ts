import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarFeriadoInput, AtualizarFeriadoInput } from '@escalas/shared-schemas';
import { HttpError, NotFoundError } from '../utils/errors.js';

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export const feriadoService = {
  async listar({ ano }: { ano?: number }, prisma: PrismaClient) {
    const where: Prisma.FeriadoWhereInput = ano
      ? {
          data: {
            gte: new Date(`${ano}-01-01T00:00:00.000Z`),
            lte: new Date(`${ano}-12-31T23:59:59.999Z`),
          },
        }
      : {};

    return prisma.feriado.findMany({
      where,
      orderBy: { data: 'asc' },
    });
  },

  async criar(input: CriarFeriadoInput, prisma: PrismaClient) {
    try {
      return await prisma.feriado.create({
        data: {
          data: toUtcDate(input.data),
          descricao: input.descricao,
          tipo: input.tipo,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new HttpError(409, 'Já existe feriado nesta data.');
      }
      throw e;
    }
  },

  async atualizar(id: number, input: AtualizarFeriadoInput, prisma: PrismaClient) {
    const existing = await prisma.feriado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feriado não encontrado.');

    try {
      return await prisma.feriado.update({
        where: { id },
        data: {
          ...(input.data !== undefined && { data: toUtcDate(input.data) }),
          ...(input.descricao !== undefined && { descricao: input.descricao }),
          ...(input.tipo !== undefined && { tipo: input.tipo }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new HttpError(409, 'Já existe feriado nesta data.');
      }
      throw e;
    }
  },

  async remover(id: number, prisma: PrismaClient) {
    const existing = await prisma.feriado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feriado não encontrado.');

    return prisma.feriado.delete({ where: { id } });
  },
};
