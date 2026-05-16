import cron from 'node-cron';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { syncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

let running = false;

export function startSyncCron(): void {
  cron.schedule(env.SYNC_INTERVAL_CRON, async () => {
    if (running) {
      logger.warn('sync_cron_skipped_overlap');
      return;
    }
    running = true;
    try {
      logger.info('sync_cron_tick');
      await syncService.runOnce(prisma);
    } catch (e) {
      logger.error('sync_cron_failed', { err: (e as Error).message });
    } finally {
      running = false;
    }
  });
  logger.info('sync_cron_started', { schedule: env.SYNC_INTERVAL_CRON });
}
