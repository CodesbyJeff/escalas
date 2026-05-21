import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { requireEscalaAccess } from '../middlewares/requireEscalaAccess.js';
import { validate } from '../middlewares/validate.js';
import { criarEscalaSchema, putDiaSchema, duplicarDiaSchema } from '@escalas/shared-schemas';
import { escalaController } from '../controllers/escala.controller.js';

export const escalaRoutes = Router();

escalaRoutes.use(authMiddleware);

escalaRoutes.get('/', escalaController.listar);
escalaRoutes.post(
  '/',
  requireRole(['ESCALANTE'], { lotacaoIdFrom: 'body', key: 'lotacao_id' }),
  validate(criarEscalaSchema),
  escalaController.criar,
);

escalaRoutes.get('/:id', requireEscalaAccess, escalaController.getDetalhe);
escalaRoutes.get('/:id/mes', requireEscalaAccess, escalaController.getMes);
escalaRoutes.get('/:id/dias/:data', requireEscalaAccess, escalaController.getDia);
escalaRoutes.put('/:id/dias/:data', requireEscalaAccess, validate(putDiaSchema), escalaController.putDia);
escalaRoutes.post('/:id/dias/:data/duplicar', requireEscalaAccess, validate(duplicarDiaSchema), escalaController.duplicarDia);
escalaRoutes.post('/:id/publicar', requireEscalaAccess, escalaController.publicar);
escalaRoutes.delete('/:id', requireEscalaAccess, escalaController.deletar);
escalaRoutes.get('/:id/versoes', requireEscalaAccess, escalaController.listarVersoes);
escalaRoutes.get('/:id/versoes/:versao', requireEscalaAccess, escalaController.getVersao);
