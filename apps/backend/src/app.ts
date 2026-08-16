import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middlewares/error.js';
import { env } from './config/env.js';

export function buildApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.origins }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1', router);
  app.use(errorHandler);
  return app;
}
