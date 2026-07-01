import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { layoutService } from '../services/template.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

export const templateController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layouts listados.', await layoutService.listarPorLotacao(Number(req.params.lotacao_id), prisma)); }
    catch (e) { handle(res, next, e); }
  },
  async obter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const l = await layoutService.obter(Number(req.params.id), prisma);
      if (!l) { fail(res, 'Layout não encontrado.', 404); return; }
      ok(res, 'Layout obtido.', l);
    } catch (e) { handle(res, next, e); }
  },
  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layout criado.', await layoutService.criar(Number(req.params.lotacao_id), req.user!.id, req.body, prisma), 201); }
    catch (e) { handle(res, next, e); }
  },
  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ok(res, 'Layout atualizado.', await layoutService.atualizar(Number(req.params.id), req.user!.id, req.body, prisma)); }
    catch (e) { handle(res, next, e); }
  },
  async excluir(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { await layoutService.excluir(Number(req.params.id), prisma); ok(res, 'Layout excluído.', null); }
    catch (e) { handle(res, next, e); }
  },
};
