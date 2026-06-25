import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { execucaoController } from '../controllers/execucao.controller.js';

export const execucaoRoutes = Router();

execucaoRoutes.use(authMiddleware);

execucaoRoutes.get('/pendentes/fiscal', execucaoController.pendentesFiscal);
execucaoRoutes.get('/pendentes/gestor', execucaoController.pendentesGestor);
