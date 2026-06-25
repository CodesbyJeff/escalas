import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { execucaoController } from '../controllers/execucao.controller.js';

export const execucaoRoutes = Router();

execucaoRoutes.use(authMiddleware);

// Fix 5: guards de role nas rotas standalone de pendentes
execucaoRoutes.get('/pendentes/fiscal', requireRole(['FISCAL']), execucaoController.pendentesFiscal);
execucaoRoutes.get('/pendentes/gestor', requireRole(['GESTOR']), execucaoController.pendentesGestor);
