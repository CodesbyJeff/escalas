import type { PrismaClient } from '@prisma/client';

export const templateService = {
  async getByLotacao(lotacao_id: number, prisma: PrismaClient) {
    return prisma.templateLotacao.findUnique({
      where: { lotacao_id },
      include: {
        guarnicoes: {
          orderBy: { ordem: 'asc' },
          include: { vagas_sugeridas: { orderBy: { id: 'asc' } } },
        },
      },
    });
  },
};
