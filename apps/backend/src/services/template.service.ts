import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarLayoutInput } from '@escalas/shared-schemas';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { normalizeFuncao } from '../utils/funcao.js';

const includeAninhado = {
  guarnicoes: { orderBy: { ordem: 'asc' as const }, include: { vagas_sugeridas: { orderBy: { id: 'asc' as const } } } },
};

function mapGuarnicaoCreate(g: CriarLayoutInput['guarnicoes'][number]) {
  return {
    sigla: g.sigla, atividade: g.atividade,
    turno_padrao_inicio: g.turno_padrao_inicio, turno_padrao_fim: g.turno_padrao_fim,
    ordem: g.ordem, ciclo_dias: g.ciclo_dias ?? null,
    vagas_sugeridas: { create: g.vagas_sugeridas.map((v) => ({ funcao: v.funcao, quantidade_sugerida: v.quantidade_sugerida })) },
  };
}

// Regra do layout é por (template_id, funcao_norm): dedupe por função (última vence).
async function syncLayoutPatentes(tx: Prisma.TransactionClient, template_id: number, guarnicoes: CriarLayoutInput['guarnicoes']) {
  await tx.funcaoPatente.deleteMany({ where: { template_id } });
  const porFuncao = new Map<string, number[]>();
  for (const g of guarnicoes) {
    for (const v of g.vagas_sugeridas) {
      const pats = v.patentes_esperadas ?? [];
      if (pats.length > 0) porFuncao.set(normalizeFuncao(v.funcao), pats);
    }
  }
  for (const [funcao_norm, patente_ids] of porFuncao) {
    await tx.funcaoPatente.create({ data: { template_id, funcao_norm, patente_ids } });
  }
}

// Anexa patentes_esperadas (das regras FuncaoPatente do template) a cada vaga sugerida, por funcao_norm.
async function anexarPatentes<T extends { id: number; guarnicoes: { vagas_sugeridas: { funcao: string }[] }[] }>(tpl: T, prisma: PrismaClient): Promise<T> {
  const regras = await prisma.funcaoPatente.findMany({ where: { template_id: tpl.id } });
  const porFuncao = new Map(regras.map((r) => [r.funcao_norm, r.patente_ids] as const));
  for (const g of tpl.guarnicoes) {
    for (const v of g.vagas_sugeridas as ({ funcao: string } & { patentes_esperadas: number[] })[]) {
      v.patentes_esperadas = porFuncao.get(normalizeFuncao(v.funcao)) ?? [];
    }
  }
  return tpl;
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
    const tpl = await prisma.templateLotacao.findUnique({ where: { id }, include: includeAninhado });
    return tpl ? anexarPatentes(tpl, prisma) : tpl;
  },

  async criar(lotacao_id: number, user_id: number, input: CriarLayoutInput, prisma: PrismaClient) {
    const lot = await prisma.lotacao.findUnique({ where: { id: lotacao_id } });
    if (!lot) throw new NotFoundError('Lotação não encontrada.');
    try {
      const tpl = await prisma.$transaction(async (tx) => {
        const criado = await tx.templateLotacao.create({
          data: { lotacao_id, nome: input.nome, criado_por_id: user_id, guarnicoes: { create: input.guarnicoes.map(mapGuarnicaoCreate) } },
          include: includeAninhado,
        });
        await syncLayoutPatentes(tx, criado.id, input.guarnicoes);
        return criado;
      });
      return anexarPatentes(tpl, prisma);
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
        await syncLayoutPatentes(tx, id, input.guarnicoes);
        return anexarPatentes(await tx.templateLotacao.findUniqueOrThrow({ where: { id }, include: includeAninhado }), tx as unknown as PrismaClient);
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
