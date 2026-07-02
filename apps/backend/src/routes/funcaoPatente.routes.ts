import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { criarFuncaoPatenteSchema, atualizarFuncaoPatenteSchema } from '@escalas/shared-schemas';
import { funcaoPatenteController } from '../controllers/funcaoPatente.controller.js';

export const funcaoPatenteRoutes = Router();
funcaoPatenteRoutes.use(authMiddleware);

funcaoPatenteRoutes.get('/', funcaoPatenteController.listar);
funcaoPatenteRoutes.post('/', requireSuperAdmin, validate(criarFuncaoPatenteSchema), funcaoPatenteController.criar);
funcaoPatenteRoutes.put('/:id', requireSuperAdmin, validate(atualizarFuncaoPatenteSchema), funcaoPatenteController.atualizar);
funcaoPatenteRoutes.delete('/:id', requireSuperAdmin, funcaoPatenteController.remover);

export const patenteRoutes = Router();
patenteRoutes.use(authMiddleware);
patenteRoutes.get('/', funcaoPatenteController.listarPatentes);
