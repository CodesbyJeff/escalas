import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { validacaoController } from '../controllers/validacao.controller.js';

export const validacaoRoutes = Router();

validacaoRoutes.use(authMiddleware);

validacaoRoutes.get('/pendentes', validacaoController.pendentes);
