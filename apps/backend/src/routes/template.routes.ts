import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { validate } from '../middlewares/validate.js';
import { upsertTemplateLotacaoSchema } from '@escalas/shared-schemas';
import { templateController } from '../controllers/template.controller.js';

export const templateRoutes = Router();

templateRoutes.use(authMiddleware);

// Leitura: ESCALANTE ou GESTOR da lotação (super-admin passa direto via requireRole)
templateRoutes.get(
  '/lotacao/:lotacao_id',
  requireRole(['ESCALANTE', 'GESTOR'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }),
  templateController.getByLotacao,
);

// Escrita: somente ESCALANTE da lotação (super-admin passa direto)
templateRoutes.put(
  '/lotacao/:lotacao_id',
  requireRole(['ESCALANTE'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }),
  validate(upsertTemplateLotacaoSchema),
  templateController.upsert,
);
