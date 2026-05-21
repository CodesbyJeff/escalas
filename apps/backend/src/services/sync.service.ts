import type { PrismaClient } from '@prisma/client';
import { sisbomClient } from '../integrations/sisbom/client.js';
import { userService } from './user.service.js';
import { logger } from '../utils/logger.js';

const TRACKED = ['militar'] as const;
const MAX_SYNC_ITER = 1000;
const SNAPSHOT_PAGE = 500;

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
  // Sync incremental: lê _mirror_ref pra decidir o que mudou, depois puxa _history (eventos).
  async runOnce(prisma: PrismaClient): Promise<void> {
    let mirror;
    try {
      mirror = await sisbomClient.getMirrorRef();
    } catch (e) {
      logger.error('sync_mirror_ref_failed', { err: (e as Error).message });
      return;
    }

    for (const entidade of TRACKED) {
      const remoteTs = mirror.ref?.[entidade];
      if (!remoteTs) continue;
      const cursor = await getCursor(prisma, entidade);
      if (cursor.last_mirror_ref_at >= new Date(remoteTs)) continue;

      let since = cursor.last_sync_at.toISOString();
      let lastSeenTs = since;
      let iter = 0;
      while (true) {
        if (++iter > MAX_SYNC_ITER) {
          logger.error('sync_max_iter_exceeded', { entidade, iter, since });
          break;
        }
        const resp = await sisbomClient.getEvents({ since, entities: entidade });
        if (resp.is_stale) {
          logger.warn('sync_since_stale_bulk_recommended', { entidade, since });
        }
        for (const ev of resp.events) {
          try {
            await prisma.$transaction(async (tx) => {
              if (ev.entity === 'militar') await userService.applyEvent(ev, tx as PrismaClient);
            });
            lastSeenTs = ev.at;
          } catch (e) {
            logger.error('sync_event_failed_skipping', {
              entidade,
              eventTs: ev.at,
              sisbom_id: ev.entity_id,
              err: (e as Error).message,
            });
            // avança cursor mesmo em erro — evita travar permanente em bad data
            lastSeenTs = ev.at;
          }
        }
        if (!resp.has_more) break;
        since = resp.next_since ?? lastSeenTs;
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

  // Carga completa via /external/snapshot (bulk inicial / recuperação fora da janela de 7 dias).
  async bulkSnapshot(prisma: PrismaClient): Promise<void> {
    for (const entidade of TRACKED) {
      let skip = 0;
      let total = 0;
      let iter = 0;
      while (true) {
        if (++iter > MAX_SYNC_ITER) {
          logger.error('bulk_max_iter_exceeded', { entidade, skip });
          break;
        }
        const resp = await sisbomClient.getSnapshot({ entity: entidade, skip, limit: SNAPSHOT_PAGE });
        for (const item of resp.items) {
          try {
            if (entidade === 'militar') {
              await userService.upsertFromSisbom(item, new Date(), prisma);
              total++;
            }
          } catch (e) {
            logger.error('bulk_item_failed_skipping', {
              entidade,
              sisbom_id: item._id,
              err: (e as Error).message,
            });
          }
        }
        if (!resp.has_more) break;
        skip += SNAPSHOT_PAGE;
      }
      logger.info('bulk_snapshot_done', { entidade, total });
    }

    // Após o bulk, alinha o cursor ao mirror-ref atual pra o incremental seguir daqui.
    try {
      const mirror = await sisbomClient.getMirrorRef();
      for (const entidade of TRACKED) {
        const remoteTs = mirror.ref?.[entidade];
        if (!remoteTs) continue;
        await getCursor(prisma, entidade);
        await prisma.syncCursor.update({
          where: { entidade },
          data: { last_sync_at: new Date(remoteTs), last_mirror_ref_at: new Date(remoteTs) },
        });
      }
    } catch (e) {
      logger.error('bulk_cursor_update_failed', { err: (e as Error).message });
    }
  },
};
