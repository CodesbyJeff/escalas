import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/requireRole.js';
import { requireEscalaAccess } from '../middlewares/requireEscalaAccess.js';
import { validate } from '../middlewares/validate.js';
import { criarEscalaSchema, putDiaSchema, duplicarDiaSchema, validarEscalaSchema, putExecucaoSchema, validarExecucaoSchema } from '@escalas/shared-schemas';
import { escalaController } from '../controllers/escala.controller.js';
import { validacaoController } from '../controllers/validacao.controller.js';
import { execucaoController } from '../controllers/execucao.controller.js';
import { resumoServicoController } from '../controllers/resumoServico.controller.js';

export const escalaRoutes = Router();

escalaRoutes.use(authMiddleware);

escalaRoutes.get('/', escalaController.listar);
escalaRoutes.post(
  '/',
  requireRole(['ESCALANTE'], { lotacaoIdFrom: 'body', key: 'lotacao_id' }),
  validate(criarEscalaSchema),
  escalaController.criar,
);

escalaRoutes.get('/:id', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.getDetalhe);
escalaRoutes.get('/:id/mes', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.getMes);
escalaRoutes.get('/:id/dias/:data', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.getDia);
escalaRoutes.put('/:id/dias/:data', requireEscalaAccess(['ESCALANTE']), validate(putDiaSchema), escalaController.putDia);
escalaRoutes.post('/:id/dias/:data/duplicar', requireEscalaAccess(['ESCALANTE']), validate(duplicarDiaSchema), escalaController.duplicarDia);
escalaRoutes.post('/:id/publicar', requireEscalaAccess(['ESCALANTE']), escalaController.publicar);
escalaRoutes.delete('/:id', requireEscalaAccess(['ESCALANTE']), escalaController.deletar);
escalaRoutes.get('/:id/versoes', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.listarVersoes);
escalaRoutes.get('/:id/versoes/:versao', requireEscalaAccess(['ESCALANTE', 'GESTOR']), escalaController.getVersao);

escalaRoutes.get('/:id/mapa-forca', requireEscalaAccess(['ESCALANTE', 'GESTOR']), validacaoController.mapaForca);
escalaRoutes.post('/:id/validar', requireEscalaAccess(['GESTOR']), validate(validarEscalaSchema), validacaoController.validar);
escalaRoutes.get('/:id/validacoes', requireEscalaAccess(['ESCALANTE', 'GESTOR']), validacaoController.listarValidacoes);

escalaRoutes.get(
  '/:id/militares',
  requireEscalaAccess(['ESCALANTE', 'GESTOR']),
  escalaController.listarMilitares,
);

escalaRoutes.get('/:id/resumo-servicos', requireEscalaAccess(['ESCALANTE', 'GESTOR']), resumoServicoController.resumo);

// Execução / fiscalização
escalaRoutes.get('/:id/execucao/:data', requireEscalaAccess(['FISCAL', 'GESTOR']), execucaoController.getDia);
escalaRoutes.put('/:id/execucao/:data', requireEscalaAccess(['FISCAL']), validate(putExecucaoSchema), execucaoController.salvar);
escalaRoutes.post('/:id/execucao/:data/fechar', requireEscalaAccess(['FISCAL']), execucaoController.fechar);
escalaRoutes.post('/:id/execucao/:data/validar', requireEscalaAccess(['GESTOR']), validate(validarExecucaoSchema), execucaoController.validar);
