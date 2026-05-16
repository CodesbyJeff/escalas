import type { PrismaClient } from '@prisma/client';
import type { SyncEvent } from '../integrations/sisbom/types.js';
import { logger } from '../utils/logger.js';

function normalizeCpf(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export const userService = {
  async applyEvent(event: SyncEvent, prisma: PrismaClient): Promise<void> {
    if (event.entity !== 'users') return;
    const data = event.data;
    const sisbom_id = String(data._id ?? '');
    const ts = new Date(event.timestamp);

    if (event.type === 'del') {
      await prisma.user.updateMany({
        where: { sisbom_id },
        data: { ativo: false, last_sync_at: ts },
      });
      return;
    }

    const cpf = normalizeCpf(data.str_cpf);
    const matricula = data.str_matricula ? String(data.str_matricula).replace(/\D/g, '') : null;
    const payload = {
      cpf,
      matricula,
      nome: String(data.str_nome ?? ''),
      nome_curto: data.str_nomecurto ? String(data.str_nomecurto) : null,
      email: data.str_email ? String(data.str_email) : null,
      phone: data.str_telefonecelular ? String(data.str_telefonecelular) : null,
      sisbom_id,
      ativo: true,
      last_sync_at: ts,
    };

    if (!cpf) {
      logger.warn('user_event_skipped_no_cpf', { sisbom_id, type: event.type });
      return;
    }

    await prisma.user.upsert({
      where: { sisbom_id },
      update: payload,
      create: payload,
    });
  },
};
