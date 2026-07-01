import type { PrismaClient } from '@prisma/client';
import type { SyncEvent } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

function normalizeCpf(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export const userService = {
  // Aplica um evento de _history (militar) à réplica local de usuários.
  async applyEvent(event: SyncEvent, prisma: PrismaClient): Promise<void> {
    if (event.entity !== 'militar') return;
    const sisbom_id = String(event.entity_id ?? event.data?._id ?? '');
    if (!sisbom_id) return;
    const ts = new Date(event.at);

    if (event.op === 'delete' || event.op === 'remove') {
      await prisma.user.updateMany({
        where: { sisbom_id },
        data: { ativo: false, last_sync_at: ts },
      });
      return;
    }

    await userService.upsertFromSisbom(event.data ?? {}, ts, prisma);
  },

  // Upsert de um militar (do evento ou do snapshot) na tabela User local.
  async upsertFromSisbom(
    data: Record<string, unknown>,
    ts: Date,
    prisma: PrismaClient,
  ): Promise<void> {
    const sisbom_id = String(data._id ?? '');
    const cpf = normalizeCpf(data.str_cpf);
    if (!cpf) {
      logger.warn('user_sync_skipped_no_cpf', { sisbom_id });
      return;
    }
    const pessoa = data.pessoa as Record<string, unknown> | undefined;
    const lotacaoRef = data._lotacao ? String(data._lotacao) : '';
    const payload = {
      cpf,
      matricula: data.str_matricula ? String(data.str_matricula).replace(/\D/g, '') : null,
      nome: String(pessoa?.str_nome ?? ''),
      nome_curto: data.str_nomecurto ? String(data.str_nomecurto) : null,
      sisbom_id,
      ativo: data.ativo === undefined ? true : Boolean(data.ativo),
      sisbom_lotacao_ref: lotacaoRef || null,
      last_sync_at: ts,
    };

    const anterior = await prisma.user.findUnique({
      where: { sisbom_id },
      select: { id: true, sisbom_lotacao_ref: true },
    });
    const user = await prisma.user.upsert({
      where: { sisbom_id },
      update: payload,
      create: payload,
    });
    await userService.linkLotacao(user.id, anterior?.sisbom_lotacao_ref ?? null, lotacaoRef, prisma);
  },

  // Reconciliação do vínculo de lotação derivado do SISBOM.
  async linkLotacao(
    userId: number,
    refAntigo: string | null,
    refNovo: string,
    prisma: PrismaClient,
  ): Promise<void> {
    // remove o vínculo do ref antigo (se mudou) — sem tocar vínculos manuais
    if (refAntigo && refAntigo !== refNovo) {
      const antiga = await prisma.lotacao.findUnique({ where: { sisbom_ref: refAntigo } });
      if (antiga) {
        await prisma.userLotacao.deleteMany({ where: { user_id: userId, lotacao_id: antiga.id } });
      }
    }
    if (!refNovo) return;
    const nova = await prisma.lotacao.findUnique({ where: { sisbom_ref: refNovo } });
    if (!nova) {
      logger.warn('user_sync_lotacao_nao_encontrada', { userId, ref: refNovo });
      return;
    }
    await prisma.userLotacao.upsert({
      where: { user_id_lotacao_id: { user_id: userId, lotacao_id: nova.id } },
      update: { nivel: nova.nivel },
      create: { user_id: userId, lotacao_id: nova.id, nivel: nova.nivel },
    });
  },
};
