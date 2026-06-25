// apps/backend/src/services/me.service.ts
import { type PrismaClient, type EscalaStatus } from '@prisma/client';
import type { MeuServicoDTO } from '@escalas/shared-types';

const VISIVEIS: EscalaStatus[] = ['publicada', 'em_validacao', 'aprovada'];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const meService = {
  async listarMeusServicos(
    userId: number,
    from: Date,
    to: Date,
    prisma: PrismaClient,
  ): Promise<MeuServicoDTO[]> {
    const vagas = await prisma.vaga.findMany({
      where: {
        militar_id: userId,
        guarnicao: {
          dia: {
            data: { gte: from, lte: to },
            escala: { status: { in: VISIVEIS } },
          },
        },
      },
      include: {
        guarnicao: {
          include: {
            dia: { include: { escala: { include: { lotacao: true } } } },
          },
        },
      },
    });

    const servicos: MeuServicoDTO[] = vagas.map((v) => ({
      vaga_id: v.id,
      data: ymd(v.guarnicao.dia.data),
      funcao: v.funcao,
      turno_inicio: v.turno_inicio,
      turno_fim: v.turno_fim,
      guarnicao: {
        sigla: v.guarnicao.sigla,
        atividade: v.guarnicao.atividade,
        turno_inicio: v.guarnicao.turno_inicio,
        turno_fim: v.guarnicao.turno_fim,
      },
      lotacao: {
        id: v.guarnicao.dia.escala.lotacao.id,
        sigla: v.guarnicao.dia.escala.lotacao.sigla,
        nome: v.guarnicao.dia.escala.lotacao.nome,
      },
    }));

    servicos.sort((a, b) => (a.data === b.data ? a.turno_inicio.localeCompare(b.turno_inicio) : a.data.localeCompare(b.data)));
    return servicos;
  },
};
