import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { resumoServicoService } from '../services/resumoServico.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

export const resumoServicoController = {
  // GET /api/v1/escalas/:id/resumo-servicos — contagem local de serviços por militar.
  async resumo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lista = await resumoServicoService.calcular(Number(req.params.id), prisma);
      ok(res, 'Resumo de serviços calculado.', lista);
    } catch (e) { handle(res, next, e); }
  },
};
