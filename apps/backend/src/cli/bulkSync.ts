import { prisma } from '../config/db.js';
import { syncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  logger.info('bulk_sync_started');
  await syncService.bulkSnapshot(prisma);
  logger.info('bulk_sync_done');
}

main()
  .catch((e) => {
    logger.error('bulk_sync_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
