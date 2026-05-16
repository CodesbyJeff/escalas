import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { startSyncCron } from './jobs/syncCron.js';

const app = buildApp();

app.listen(env.API_PORT, () => {
  logger.info('server_started', { port: env.API_PORT, env: env.NODE_ENV });
  if (env.NODE_ENV !== 'test') startSyncCron();
});
