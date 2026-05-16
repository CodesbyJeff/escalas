import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middlewares/error.js';

export function buildApp(): Express {
  const app = express();
  app.use(helmet());
  // TODO: restringir origin via env (ALLOWED_ORIGINS) antes de produção
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/v1', router);
  app.use(errorHandler);
  return app;
}
