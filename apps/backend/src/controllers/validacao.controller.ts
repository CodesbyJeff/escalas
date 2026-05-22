import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { validacaoService } from '../services/validacao.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) {
    fail(res, e.message, e.status);
    return;
  }
  next(e);
}

export const validacaoController = {
  // GET /api/v1/validacoes/pendentes — escalas em_validacao das lotações onde é GESTOR.
  async pendentes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let lotacao_ids: number[] | undefined;
      if (!req.user!.is_super_admin) {
        const roles = await prisma.userRole.findMany({
          where: { user_id: req.user!.id, role: 'GESTOR' },
          select: { lotacao_id: true },
        });
        lotacao_ids = roles.map((r) => r.lotacao_id).filter((x): x is number => x != null);
      }
      const lista = await validacaoService.listarPendentes(lotacao_ids, prisma);
      ok(res, 'Escalas pendentes de validação.', lista);
    } catch (e) { next(e); }
  },

  // GET /api/v1/escalas/:id/mapa-forca — proxy do mapa de força do SISBOM.
  async mapaForca(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const mapa = await validacaoService.getMapaForca(Number(req.params.id), date, prisma);
      ok(res, 'Mapa de força obtido.', mapa);
    } catch (e) { handle(res, next, e); }
  },

  // POST /api/v1/escalas/:id/validar — aprova/rejeita.
  async validar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validacao = await validacaoService.validar(Number(req.params.id), req.body, req.user!.id, prisma);
      ok(res, 'Escala validada.', validacao, 201);
    } catch (e) { handle(res, next, e); }
  },

  // GET /api/v1/escalas/:id/validacoes — histórico de validações da escala.
  async listarValidacoes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lista = await validacaoService.listarValidacoes(Number(req.params.id), prisma);
      ok(res, 'Validações listadas.', lista);
    } catch (e) { next(e); }
  },
};
