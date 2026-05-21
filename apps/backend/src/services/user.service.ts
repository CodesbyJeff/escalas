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
    const payload = {
      cpf,
      matricula: data.str_matricula ? String(data.str_matricula).replace(/\D/g, '') : null,
      nome: String(pessoa?.str_nome ?? ''),
      nome_curto: data.str_nomecurto ? String(data.str_nomecurto) : null,
      sisbom_id,
      ativo: data.ativo === undefined ? true : Boolean(data.ativo),
      last_sync_at: ts,
    };

    await prisma.user.upsert({
      where: { sisbom_id },
      update: payload,
      create: payload,
    });
  },
};
