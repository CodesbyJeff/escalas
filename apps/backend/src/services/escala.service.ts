import { Prisma, type PrismaClient } from '@prisma/client';
import type { CriarEscalaInput, PutDiaInput } from '@escalas/shared-schemas';
import { ConflictError, NotFoundError, HttpError } from '../utils/errors.js';
import { diasDoMes } from '../utils/calendario.js';
import { encontrarConflitos } from '../utils/turnos.js';
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

  async getDia(escala_id: number, dataStr: string, prisma: PrismaClient) {
    return prisma.escalaDia.findFirst({
      where: { escala_id, data: new Date(`${dataStr}T00:00:00.000Z`) },
      include: { guarnicoes: { orderBy: { ordem: 'asc' }, include: { vagas: { orderBy: { id: 'asc' } } } } },
    });
  },

  async putDia(
    escala_id: number,
    dataStr: string,
    input: PutDiaInput,
    user_id: number,
    prisma: PrismaClient,
  ) {
    const data = new Date(`${dataStr}T00:00:00.000Z`);
    const dia = await prisma.escalaDia.findFirst({
      where: { escala_id, data },
      include: { guarnicoes: { include: { vagas: true } } },
    });
    if (!dia) throw new NotFoundError('Dia não encontrado nesta escala.');

    const todasVagas = input.guarnicoes.flatMap((g, gi) =>
      g.vagas.map((v, vi) => ({
        id: gi * 1000 + vi,
        militar_id: v.militar_id,
        turno_inicio: v.turno_inicio,
        turno_fim: v.turno_fim,
      })),
    );
    const conflitos = encontrarConflitos(todasVagas);
    if (conflitos.length > 0) {
      const err = new HttpError(422, 'Militar em vagas com turnos sobrepostos no mesmo dia.');
      (err as unknown as { conflitos: unknown }).conflitos = conflitos;
      throw err;
    }

    const antes = { guarnicoes: dia.guarnicoes };

    return prisma.$transaction(async (tx) => {
      await tx.escalaGuarnicao.deleteMany({ where: { escala_dia_id: dia.id } });
      await tx.escalaDia.update({
        where: { id: dia.id },
        data: {
          observacoes: input.observacoes ?? null,
          guarnicoes: {
            create: input.guarnicoes.map((g) => ({
              sigla: g.sigla,
              atividade: g.atividade,
              viatura_id: g.viatura_id ?? null,
              turno_inicio: g.turno_inicio,
              turno_fim: g.turno_fim,
              ordem: g.ordem,
              vagas: {
                create: g.vagas.map((v) => ({
                  funcao: v.funcao,
                  militar_id: v.militar_id,
                  turno_inicio: v.turno_inicio,
                  turno_fim: v.turno_fim,
                  observacoes: v.observacoes ?? null,
                })),
              },
            })),
          },
        },
      });
      const novo = await tx.escalaDia.findUniqueOrThrow({
        where: { id: dia.id },
        include: { guarnicoes: { orderBy: { ordem: 'asc' }, include: { vagas: { orderBy: { id: 'asc' } } } } },
      });
      await auditService.log(
        { user_id, acao: 'editar', entidade: 'EscalaDia', entidade_id: dia.id, antes: antes as never, depois: { guarnicoes: novo.guarnicoes } as never },
        tx,
      );
      return novo;
    });
  },

  async duplicarDia(
    escala_id: number,
    dataDestinoStr: string,
    dataOrigemStr: string,
    user_id: number,
    prisma: PrismaClient,
  ) {
    const origem = await this.getDia(escala_id, dataOrigemStr, prisma);
    if (!origem) throw new NotFoundError('Dia de origem não encontrado.');

    const input = {
      observacoes: origem.observacoes,
      guarnicoes: origem.guarnicoes.map((g) => ({
        sigla: g.sigla,
        atividade: g.atividade,
        viatura_id: g.viatura_id,
        turno_inicio: g.turno_inicio,
        turno_fim: g.turno_fim,
        ordem: g.ordem,
        vagas: g.vagas.map((v) => ({
          funcao: v.funcao,
          militar_id: v.militar_id,
          turno_inicio: v.turno_inicio,
          turno_fim: v.turno_fim,
          observacoes: v.observacoes ?? undefined,
        })),
      })),
    };
    return this.putDia(escala_id, dataDestinoStr, input, user_id, prisma);
  },
};
