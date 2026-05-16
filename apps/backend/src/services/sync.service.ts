import type { PrismaClient } from '@prisma/client';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { userService } from './user.service.js';
import { logger } from '../utils/logger.js';

const TRACKED = ['users'] as const;

async function getCursor(prisma: PrismaClient, entidade: string) {
  return prisma.syncCursor.upsert({
    where: { entidade },
    update: {},
    create: {
      entidade,
      last_sync_at: new Date('1970-01-01'),
      last_mirror_ref_at: new Date('1970-01-01'),
    },
  });
}

export const syncService = {
  async runOnce(prisma: PrismaClient): Promise<void> {
    let mirror;
    try {
      mirror = await sisbomClient.getMirrorRef();
    } catch (e) {
      logger.error('sync_mirror_ref_failed', { err: (e as Error).message });
      return;
    }

    for (const entidade of TRACKED) {
      const remoteTs = mirror[entidade];
      if (!remoteTs) continue;
      const cursor = await getCursor(prisma, entidade);
      if (cursor.last_mirror_ref_at >= new Date(remoteTs)) continue;

      let since = cursor.last_sync_at.toISOString();
      let lastSeenTs = since;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await sisbomClient.getEvents({ since, entities: entidade });
        for (const ev of resp.events) {
          await prisma.$transaction(async (tx) => {
            if (ev.entity === 'users') await userService.applyEvent(ev, tx as PrismaClient);
          });
          lastSeenTs = ev.timestamp;
        }
        if (!resp.has_more) break;
        since = resp.next_cursor ?? lastSeenTs;
      }

      await prisma.syncCursor.update({
        where: { entidade },
        data: {
          last_sync_at: new Date(lastSeenTs),
          last_mirror_ref_at: new Date(remoteTs),
        },
      });
      logger.info('sync_entidade_done', { entidade, processedUpTo: lastSeenTs });
    }
  },
};
