import type { PrismaClient } from '@prisma/client';
import type { SyncEvent } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

function parseNivel(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) {
    logger.warn('lotacao_nivel_invalido', { nivel: v });
    return 0;
  }
  return Math.trunc(n);
}

export const lotacaoService = {
  async applyEvent(event: SyncEvent, prisma: PrismaClient): Promise<void> {
    if (event.entity !== 'lotacoes') return;
    // Delete de lotação está fora de escopo (raro; perigoso com FKs) — só aplica upserts.
    if (event.op === 'delete' || event.op === 'remove') {
      logger.warn('lotacao_delete_ignorado', { sisbom_id: event.entity_id });
      return;
    }
    await lotacaoService.upsertFromSisbom(event.data ?? {}, new Date(event.at), prisma);
  },

  async upsertFromSisbom(
    data: Record<string, unknown>,
    ts: Date,
    prisma: PrismaClient,
  ): Promise<void> {
    const sisbom_ref = data.ref ? String(data.ref) : '';
    if (!sisbom_ref) {
      logger.warn('lotacao_sync_skipped_no_ref', { sisbom_id: data._id });
      return;
    }

    const paiRef = data._pai ? String(data._pai) : '';
    let lotacao_pai_id: number | null = null;
    if (paiRef) {
      const pai = await prisma.lotacao.findUnique({ where: { sisbom_ref: paiRef } });
      lotacao_pai_id = pai?.id ?? null;
    }

    const payload = {
      sisbom_id: data._id ? String(data._id) : null,
      sisbom_ref,
      sigla: String(data.str_sigla ?? sisbom_ref),
      sigla_extenso: data.str_sigla_extenso ? String(data.str_sigla_extenso) : null,
      nome: String(data.str_nome ?? ''),
      lotacao_pai_id,
      nivel: parseNivel(data.nivel),
      operacional: Boolean(data.operacional),
      externo: Boolean(data.externo),
      last_sync_at: ts,
    };

    await prisma.lotacao.upsert({
      where: { sisbom_ref },
      update: payload,
      create: payload,
    });
  },
};
