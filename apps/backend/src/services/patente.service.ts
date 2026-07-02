import type { PrismaClient } from '@prisma/client';
import { normalizeFuncao } from '../utils/funcao.js';

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
};
