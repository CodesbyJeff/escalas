import type { PrismaClient } from '@prisma/client';
import type { UpsertTemplateLotacaoInput } from '@escalas/shared-schemas';
import { NotFoundError } from '../utils/errors.js';

const includeAninhado = {
  guarnicoes: {
    orderBy: { ordem: 'asc' as const },
    include: { vagas_sugeridas: { orderBy: { id: 'asc' as const } } },
  },
};

export const templateService = {
  async getByLotacao(lotacao_id: number, prisma: PrismaClient) {
    return prisma.templateLotacao.findUnique({
      where: { lotacao_id },
      include: includeAninhado,
    });
  },

  async upsert(
    lotacao_id: number,
    user_id: number,
    input: UpsertTemplateLotacaoInput,
    prisma: PrismaClient,
  ) {
    const lot = await prisma.lotacao.findUnique({ where: { id: lotacao_id } });
    if (!lot) throw new NotFoundError('Lotação não encontrada.');

    return prisma.$transaction(async (tx) => {
      const existente = await tx.templateLotacao.findUnique({ where: { lotacao_id } });

      if (existente) {
        // Cascade onDelete remove guarnições+vagas automaticamente
        await tx.templateGuarnicao.deleteMany({ where: { template_lotacao_id: existente.id } });
        await tx.templateLotacao.update({
          where: { id: existente.id },
          data: {
            criado_por_id: user_id,
            guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) },
          },
        });
        return tx.templateLotacao.findUniqueOrThrow({
          where: { id: existente.id },
          include: includeAninhado,
        });
      }

      return tx.templateLotacao.create({
        data: {
          lotacao_id,
          criado_por_id: user_id,
          guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) },
        },
        include: includeAninhado,
      });
    });
  },
};

function mapGuarnicaoCreate(g: UpsertTemplateLotacaoInput['guarnicoes'][number]) {
  return {
    sigla: g.sigla,
    atividade: g.atividade,
    turno_padrao_inicio: g.turno_padrao_inicio,
    turno_padrao_fim: g.turno_padrao_fim,
    ordem: g.ordem,
    vagas_sugeridas: { create: g.vagas_sugeridas },
  };
}
