// apps/backend/src/routes/me.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { meController } from '../controllers/me.controller.js';

export const meRoutes = Router();
meRoutes.use(authMiddleware);
meRoutes.get('/servicos', meController.servicos);
