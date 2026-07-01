import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { requireTemplateAccess } from '../middlewares/requireTemplateAccess.js';
import { validate } from '../middlewares/validate.js';
import { criarLayoutSchema, atualizarLayoutSchema } from '@escalas/shared-schemas';
import { templateController } from '../controllers/template.controller.js';

export const templateRoutes = Router();
templateRoutes.use(authMiddleware);

templateRoutes.get('/lotacao/:lotacao_id', requireRole(['ESCALANTE', 'GESTOR'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }), templateController.listar);
templateRoutes.post('/lotacao/:lotacao_id', requireRole(['ESCALANTE'], { lotacaoIdFrom: 'param', key: 'lotacao_id' }), validate(criarLayoutSchema), templateController.criar);
templateRoutes.get('/:id', requireTemplateAccess(['ESCALANTE', 'GESTOR']), templateController.obter);
templateRoutes.put('/:id', requireTemplateAccess(['ESCALANTE']), validate(atualizarLayoutSchema), templateController.atualizar);
templateRoutes.delete('/:id', requireTemplateAccess(['ESCALANTE']), templateController.excluir);
