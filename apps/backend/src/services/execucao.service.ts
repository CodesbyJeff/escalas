import { type PrismaClient } from '@prisma/client';
import { NotFoundError, HttpError, ConflictError } from '../utils/errors.js';
import type { ExecucaoDiaDTO, ExecucaoPendenteDTO } from '@escalas/shared-types';
import type { PutExecucaoInput, ValidarExecucaoInput } from '@escalas/shared-schemas';

// 'YYYY-MM-DD' → Date UTC meia-noite (igual ao padrão de EscalaDia)
function toUtc(data: string): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function carregarDia(escala_id: number, data: string, prisma: PrismaClient) {
  const dia = await prisma.escalaDia.findFirst({
    where: { escala_id, data: toUtc(data) },
    include: {
      guarnicoes: {
        orderBy: { ordem: 'asc' },
        include: {
          vagas: {
            include: { execucao: true },
          },
        },
      },
    },
  });
  if (!dia) throw new NotFoundError('Dia da escala não encontrado.');
  return dia;
}

function toDiaDTO(dia: Awaited<ReturnType<typeof carregarDia>>): ExecucaoDiaDTO {
  return {
    escala_id: dia.escala_id,
    data: ymd(dia.data),
    execucao_status: dia.execucao_status,
    validado_em: dia.validado_em ? dia.validado_em.toISOString() : null,
    justificativa: dia.justificativa ?? null,
    guarnicoes: dia.guarnicoes.map((g) => ({
      id: g.id,
      sigla: g.sigla,
      atividade: g.atividade,
      turno_inicio: g.turno_inicio,
      turno_fim: g.turno_fim,
      ordem: g.ordem,
      vagas: g.vagas.map((v) => ({
        id: v.id,
        funcao: v.funcao,
        militar_id: v.militar_id,
        turno_inicio: v.turno_inicio,
        turno_fim: v.turno_fim,
        execucao: v.execucao
          ? {
              vaga_id: v.id,
              situacao: v.execucao.situacao,
              militar_executado_id: v.execucao.militar_executado_id,
              do: v.execucao.do,
              observacoes: v.execucao.observacoes ?? null,
            }
          : null,
      })),
    })),
  };
}

export const execucaoService = {
  async getDia(escala_id: number, data: string, prisma: PrismaClient): Promise<ExecucaoDiaDTO> {
    return toDiaDTO(await carregarDia(escala_id, data, prisma));
  },

  async salvar(
    escala_id: number,
    data: string,
    input: PutExecucaoInput,
    fiscal_id: number,
    prisma: PrismaClient,
  ): Promise<ExecucaoDiaDTO> {
    const dia = await carregarDia(escala_id, data, prisma);
    // Fix 1: bloquear edição quando fiscal já fechou (registrada) ou gestor já validou (validada)
    if (dia.execucao_status === 'registrada' || dia.execucao_status === 'validada') {
      throw new ConflictError('Dia já fechado para validação; não pode editar.');
    }
    const vagaIds = new Set(dia.guarnicoes.flatMap((g) => g.vagas.map((v) => v.id)));
    for (const ev of input.vagas) {
      if (!vagaIds.has(ev.vaga_id)) {
        throw new HttpError(422, `Vaga ${ev.vaga_id} não pertence ao dia.`);
      }
    }
    await prisma.$transaction(async (tx) => {
      for (const ev of input.vagas) {
        await tx.execucaoVaga.upsert({
          where: { vaga_id: ev.vaga_id },
          create: {
            vaga_id: ev.vaga_id,
            situacao: ev.situacao,
            militar_executado_id: ev.militar_executado_id,
            do: ev.do,
            observacoes: ev.observacoes ?? null,
          },
          update: {
            situacao: ev.situacao,
            militar_executado_id: ev.militar_executado_id,
            do: ev.do,
            observacoes: ev.observacoes ?? null,
          },
        });
      }
      await tx.escalaDia.update({
        where: { id: dia.id },
        data: {
          fiscal_id,
          // se já estava rejeitada, salvar mantém rejeitada (não volta para pendente)
          ...(dia.execucao_status === 'rejeitada' ? {} : { execucao_status: 'pendente' }),
        },
      });
    });
    return this.getDia(escala_id, data, prisma);
  },

  async fechar(
    escala_id: number,
    data: string,
    fiscal_id: number,
    prisma: PrismaClient,
  ): Promise<ExecucaoDiaDTO> {
    const dia = await carregarDia(escala_id, data, prisma);
    // Fix 3: allowlist positiva — só permite fechar quando pendente ou rejeitada
    if (dia.execucao_status !== 'pendente' && dia.execucao_status !== 'rejeitada') {
      throw new ConflictError('Dia não está aberto para fechamento.');
    }
    // toda vaga COM militar previsto precisa de execução; VAGO sem ocupação é dispensada
    const faltando = dia.guarnicoes
      .flatMap((g) => g.vagas)
      .filter((v) => v.militar_id !== null && !v.execucao);
    if (faltando.length > 0) {
      throw new HttpError(422, 'Há vagas previstas sem situação registrada.');
    }
    await prisma.escalaDia.update({
      where: { id: dia.id },
      data: { execucao_status: 'registrada', fiscal_id },
    });
    return this.getDia(escala_id, data, prisma);
  },

  async validar(
    escala_id: number,
    data: string,
    input: ValidarExecucaoInput,
    gestor_id: number,
    prisma: PrismaClient,
  ): Promise<ExecucaoDiaDTO> {
    const dia = await carregarDia(escala_id, data, prisma);
    if (dia.execucao_status !== 'registrada') {
      throw new ConflictError('Dia não está aguardando validação.');
    }
    if (input.status === 'rejeitada' && !input.justificativa) {
      throw new HttpError(422, 'Justificativa é obrigatória ao rejeitar.');
    }
    await prisma.escalaDia.update({
      where: { id: dia.id },
      data: {
        execucao_status: input.status,
        validado_por_id: gestor_id,
        validado_em: input.status === 'validada' ? new Date() : null,
        justificativa: input.status === 'rejeitada' ? input.justificativa! : null,
      },
    });
    return this.getDia(escala_id, data, prisma);
  },

  async listarPendentesFiscal(
    lotacao_ids: number[] | undefined,
    hoje: string,
    prisma: PrismaClient,
  ): Promise<ExecucaoPendenteDTO[]> {
    const dias = await prisma.escalaDia.findMany({
      where: {
        data: { lte: toUtc(hoje) },
        execucao_status: { in: ['pendente', 'rejeitada'] },
        escala: {
          status: 'publicada',
          ...(lotacao_ids ? { lotacao_id: { in: lotacao_ids } } : {}),
        },
      },
      include: {
        escala: true,
        guarnicoes: {
          select: { _count: { select: { vagas: true } } },
        },
      },
      orderBy: { data: 'desc' },
    });
    return dias.map((d) => ({
      escala_id: d.escala_id,
      lotacao_id: d.escala.lotacao_id,
      data: ymd(d.data),
      execucao_status: d.execucao_status,
      vagas_total: d.guarnicoes.reduce((s, g) => s + g._count.vagas, 0),
    }));
  },

  async listarPendentesGestor(
    lotacao_ids: number[] | undefined,
    prisma: PrismaClient,
  ): Promise<ExecucaoPendenteDTO[]> {
    const dias = await prisma.escalaDia.findMany({
      where: {
        execucao_status: 'registrada',
        escala: {
          ...(lotacao_ids ? { lotacao_id: { in: lotacao_ids } } : {}),
        },
      },
      include: {
        escala: true,
        guarnicoes: {
          select: { _count: { select: { vagas: true } } },
        },
      },
      orderBy: { data: 'desc' },
    });
    return dias.map((d) => ({
      escala_id: d.escala_id,
      lotacao_id: d.escala.lotacao_id,
      data: ymd(d.data),
      execucao_status: d.execucao_status,
      vagas_total: d.guarnicoes.reduce((s, g) => s + g._count.vagas, 0),
    }));
  },
};
