import type { PrismaClient } from '@prisma/client';
import { normalizeFuncao } from '../utils/funcao.js';
import type { AvisoPatenteDTO } from '@escalas/shared-types';

export const patenteService = {
  async listarTodas(prisma: PrismaClient) {
    return prisma.patente.findMany({ orderBy: [{ forca_id: 'asc' }, { ordem: 'asc' }] });
  },

  // Resolve as patentes esperadas pela cascata layout → lotação → global. null = sem regra.
  async esperadasPara(
    funcao: string,
    lotacao_id: number,
    template_id: number | null,
    prisma: PrismaClient,
  ): Promise<number[] | null> {
    const funcao_norm = normalizeFuncao(funcao);

    if (template_id != null) {
      const layout = await prisma.funcaoPatente.findFirst({ where: { template_id, funcao_norm } });
      if (layout) return layout.patente_ids;
    }
    const daLotacao = await prisma.funcaoPatente.findFirst({
      where: { lotacao_id, template_id: null, funcao_norm },
    });
    if (daLotacao) return daLotacao.patente_ids;

    const global = await prisma.funcaoPatente.findFirst({
      where: { lotacao_id: null, template_id: null, funcao_norm },
    });
    if (global) return global.patente_ids;

    return null;
  },

  // Divergência = existe regra não-vazia e a patente do militar não está nela (ou é null).
  patenteDivergente(patente_id: number | null, esperadas: number[] | null): boolean {
    if (!esperadas || esperadas.length === 0) return false;
    return patente_id == null || !esperadas.includes(patente_id);
  },

  // Varre todos os dias/guarnições/vagas da escala e retorna as vagas preenchidas
  // cuja patente do militar diverge da esperada pela cascata (layout → lotação → global).
  async avisosDaEscala(escala_id: number, prisma: PrismaClient) {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id }, select: { lotacao_id: true, template_id: true } });
    if (!escala) return [];
    const dias = await prisma.escalaDia.findMany({
      where: { escala_id },
      orderBy: { data: 'asc' },
      include: {
        guarnicoes: {
          orderBy: { ordem: 'asc' },
          include: {
            vagas: {
              orderBy: { id: 'asc' },
              include: { militar: { select: { id: true, nome: true, patente_id: true, patente: { select: { sigla: true } } } } },
            },
          },
        },
      },
    });
    const memo = new Map<string, number[] | null>();
    const esperadasMemo = async (funcao: string) => {
      const k = normalizeFuncao(funcao);
      if (!memo.has(k)) memo.set(k, await this.esperadasPara(funcao, escala.lotacao_id, escala.template_id, prisma));
      return memo.get(k)!;
    };
    const out: AvisoPatenteDTO[] = [];
    for (const dia of dias) {
      const dataStr = dia.data.toISOString().slice(0, 10);
      for (const g of dia.guarnicoes) {
        for (const v of g.vagas) {
          if (!v.militar_id || !v.militar) continue;
          const esperadas = await esperadasMemo(v.funcao);
          if (!this.patenteDivergente(v.militar.patente_id ?? null, esperadas)) continue;
          out.push({
            data: dataStr,
            guarnicao_sigla: g.sigla,
            funcao: v.funcao,
            militar_id: v.militar.id,
            militar_nome: v.militar.nome,
            patente_sigla: v.militar.patente?.sigla ?? null,
            patentes_esperadas: esperadas ?? [],
          });
        }
      }
    }
    return out;
  },
};
