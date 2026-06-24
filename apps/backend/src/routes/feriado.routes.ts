import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { criarFeriadoSchema, atualizarFeriadoSchema } from '@escalas/shared-schemas';
import { feriadoController } from '../controllers/feriado.controller.js';

export const feriadoRoutes = Router();

feriadoRoutes.use(authMiddleware);

feriadoRoutes.get('/', feriadoController.listar);
feriadoRoutes.post('/', requireSuperAdmin, validate(criarFeriadoSchema), feriadoController.criar);
feriadoRoutes.put('/:id', requireSuperAdmin, validate(atualizarFeriadoSchema), feriadoController.atualizar);
feriadoRoutes.delete('/:id', requireSuperAdmin, feriadoController.remover);
