import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes/index.js';
import { errorHandler } from './middlewares/error.js';

export function buildApp(): Express {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', router);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}
