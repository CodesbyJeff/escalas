import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarEscalaInput } from '@escalas/shared-schemas';
import { ConflictError } from '../utils/errors.js';
import { diasDoMes } from '../utils/calendario.js';
import { auditService } from './audit.service.js';

export const escalaService = {
  async criar(input: CriarEscalaInput, user_id: number, prisma: PrismaClient) {
    const template = await prisma.templateLotacao.findUnique({
      where: { lotacao_id: input.lotacao_id },
      include: { guarnicoes: { include: { vagas_sugeridas: true } } },
    });
    if (!template) {
      throw new ConflictError('Configure o template da lotação antes de criar a escala.');
    }

    const existente = await prisma.escala.findUnique({
      where: { lotacao_id_mes_ano: { lotacao_id: input.lotacao_id, mes: input.mes, ano: input.ano } },
    });
    if (existente) {
      throw new ConflictError('Já existe escala para essa lotação neste mês/ano.');
    }

    const dias = diasDoMes(input.mes, input.ano);

    try {
      return await prisma.$transaction(async (tx) => {
      const nova = await tx.escala.create({
        data: {
          lotacao_id: input.lotacao_id,
          mes: input.mes,
          ano: input.ano,
          criado_por_id: user_id,
          dias: {
            create: dias.map((data) => ({
              data,
              guarnicoes: {
                create: template.guarnicoes.map((g) => ({
                  sigla: g.sigla,
                  atividade: g.atividade,
                  turno_inicio: g.turno_padrao_inicio,
                  turno_fim: g.turno_padrao_fim,
                  ordem: g.ordem,
                  vagas: {
                    create: g.vagas_sugeridas.flatMap((vs) =>
                      Array.from({ length: vs.quantidade_sugerida }, () => ({
                        funcao: vs.funcao,
                        turno_inicio: g.turno_padrao_inicio,
                        turno_fim: g.turno_padrao_fim,
                      })),
                    ),
                  },
                })),
              },
            })),
          },
        },
      });
      await auditService.log(
        { user_id, acao: 'criar', entidade: 'Escala', entidade_id: nova.id, antes: null, depois: { mes: nova.mes, ano: nova.ano, lotacao_id: nova.lotacao_id } },
        tx,
      );
      return nova;
      });
    } catch (e) {
      // P2002 = corrida na criação concorrente da mesma (lotacao, mes, ano)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictError('Já existe escala para essa lotação neste mês/ano.');
      }
      throw e;
    }
  },

  async listar(
    filtro: { lotacao_id?: number; mes?: number; ano?: number; status?: string },
    prisma: PrismaClient,
  ) {
    return prisma.escala.findMany({
      where: {
        ...(filtro.lotacao_id && { lotacao_id: filtro.lotacao_id }),
        ...(filtro.mes && { mes: filtro.mes }),
        ...(filtro.ano && { ano: filtro.ano }),
        ...(filtro.status && { status: filtro.status as never }),
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
  },

  async getDetalhe(id: number, prisma: PrismaClient) {
    return prisma.escala.findUnique({
      where: { id },
      include: {
        dias: {
          orderBy: { data: 'asc' },
          include: {
            guarnicoes: {
              orderBy: { ordem: 'asc' },
              include: { vagas: { orderBy: { id: 'asc' } } },
            },
          },
        },
      },
    });
  },

  async getMes(id: number, prisma: PrismaClient) {
    const escala = await prisma.escala.findUnique({
      where: { id },
      include: { dias: { orderBy: { data: 'asc' }, include: { guarnicoes: { include: { vagas: true } } } } },
    });
    if (!escala) return null;
    return {
      id: escala.id,
      mes: escala.mes,
      ano: escala.ano,
      status: escala.status,
      dias: escala.dias.map((d) => {
        const vagas = d.guarnicoes.flatMap((g) => g.vagas);
        const preenchidas = vagas.filter((v) => v.militar_id != null).length;
        return {
          data: d.data.toISOString().slice(0, 10),
          vagas_total: vagas.length,
          vagas_preenchidas: preenchidas,
        };
      }),
    };
  },
};
