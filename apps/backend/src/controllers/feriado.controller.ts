import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { feriadoService } from '../services/feriado.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) {
    fail(res, e.message, e.status);
    return;
  }
  next(e);
}

export const feriadoController = {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ano = req.query.ano ? Number(req.query.ano) : undefined;
      const lista = await feriadoService.listar({ ano }, prisma);
      ok(res, 'Feriados listados.', lista);
    } catch (e) {
      next(e);
    }
  },

  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feriado = await feriadoService.criar(req.body, prisma);
      ok(res, 'Feriado criado.', feriado, 201);
    } catch (e) {
      handle(res, next, e);
    }
  },

  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feriado = await feriadoService.atualizar(Number(req.params.id), req.body, prisma);
      ok(res, 'Feriado atualizado.', feriado);
    } catch (e) {
      handle(res, next, e);
    }
  },

  async remover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const feriado = await feriadoService.remover(Number(req.params.id), prisma);
      ok(res, 'Feriado removido.', feriado);
    } catch (e) {
      handle(res, next, e);
    }
  },
};
