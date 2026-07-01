import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarLayoutInput } from '@escalas/shared-schemas';
import { NotFoundError, ConflictError } from '../utils/errors.js';

const includeAninhado = {
  guarnicoes: { orderBy: { ordem: 'asc' as const }, include: { vagas_sugeridas: { orderBy: { id: 'asc' as const } } } },
};

function mapGuarnicaoCreate(g: CriarLayoutInput['guarnicoes'][number]) {
  return {
    sigla: g.sigla, atividade: g.atividade,
    turno_padrao_inicio: g.turno_padrao_inicio, turno_padrao_fim: g.turno_padrao_fim,
    ordem: g.ordem, vagas_sugeridas: { create: g.vagas_sugeridas },
  };
}

export const layoutService = {
  async listarPorLotacao(lotacao_id: number, prisma: PrismaClient) {
    const layouts = await prisma.templateLotacao.findMany({
      where: { lotacao_id }, orderBy: { nome: 'asc' },
      include: { _count: { select: { guarnicoes: true } } },
    });
    return layouts.map((l) => ({ id: l.id, lotacao_id: l.lotacao_id, nome: l.nome, qtd_guarnicoes: l._count.guarnicoes }));
  },

  async obter(id: number, prisma: PrismaClient) {
    return prisma.templateLotacao.findUnique({ where: { id }, include: includeAninhado });
  },

  async criar(lotacao_id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const lot = await prisma.lotacao.findUnique({ where: { id: lotacao_id } });
    if (!lot) throw new NotFoundError('Lotação não encontrada.');
    try {
      return await prisma.templateLotacao.create({
        data: { lotacao_id, nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
        include: includeAninhado,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe um layout com esse nome nesta lotação.');
      throw e;
    }
  },

  async atualizar(id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const existente = await prisma.templateLotacao.findUnique({ where: { id } });
    if (!existente) throw new NotFoundError('Layout não encontrado.');
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.templateGuarnicao.deleteMany({ where: { template_lotacao_id: id } });
        await tx.templateLotacao.update({
          where: { id },
          data: { nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
        });
        return tx.templateLotacao.findUniqueOrThrow({ where: { id }, include: includeAninhado });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Já existe um layout com esse nome nesta lotação.');
      throw e;
    }
  },

  async excluir(id: number, prisma: PrismaClient) {
    const existente = await prisma.templateLotacao.findUnique({ where: { id } });
    if (!existente) throw new NotFoundError('Layout não encontrado.');
    await prisma.templateLotacao.delete({ where: { id } });
  },
};
