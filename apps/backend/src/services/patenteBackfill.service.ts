import type { PrismaClient } from '@prisma/client';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

// A patente real do militar NÃO vem no cadastro (/external/militar traz _patente null);
// ela vive na guarnição do mapa de força (guarnicao[]._patente, por serviço). Aqui
// resolvemos, por militar (sisbom_id), a patente do serviço mais recente (maior date_start).
export function patentesMaisRecentes(docs: MapaGuarnicaoDoc[]): Map<string, number> {
  const melhor = new Map<string, { patente: number; data: string }>();
  for (const d of docs) {
    const data = d.date_start ?? '';
    for (const m of d.guarnicao ?? []) {
      const mid = m._militar ?? m._id;
      if (!mid || m._patente == null) continue;
      const atual = melhor.get(mid);
      if (!atual || data > atual.data) melhor.set(mid, { patente: m._patente, data });
    }
  }
  const out = new Map<string, number>();
  for (const [mid, v] of melhor) out.set(mid, v.patente);
  return out;
}

export const patenteBackfillService = {
  // Popula User.patente_id a partir da patente mais recente observada no mapa de força.
  // Só grava patentes que existem na tabela local Patente (guard, espelha o sync).
  async backfill(prisma: PrismaClient, docs: MapaGuarnicaoDoc[]) {
    const mapa = patentesMaisRecentes(docs);
    const patentesValidas = new Set((await prisma.patente.findMany({ select: { id: true } })).map((p) => p.id));
    let atualizados = 0;
    let ignoradosPatenteInvalida = 0;
    for (const [sisbomId, patenteId] of mapa) {
      if (!patentesValidas.has(patenteId)) { ignoradosPatenteInvalida++; continue; }
      const r = await prisma.user.updateMany({ where: { sisbom_id: sisbomId }, data: { patente_id: patenteId } });
      atualizados += r.count;
    }
    logger.info('patente_backfill_done', { militares_no_mapa: mapa.size, atualizados, ignorados_patente_invalida: ignoradosPatenteInvalida });
    return { militares_no_mapa: mapa.size, atualizados, ignorados_patente_invalida: ignoradosPatenteInvalida };
  },
};
