import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { funcaoPatenteService } from '../services/funcaoPatente.service.js';
import { patenteService } from '../services/patente.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) {
    fail(res, e.message, e.status);
    return;
  }
  next(e);
}

export const funcaoPatenteController = {
  async listarPatentes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ok(res, 'Patentes listadas.', await patenteService.listarTodas(prisma));
    } catch (e) {
      next(e);
    }
  },
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const raw = req.query.lotacao_id ? Number(req.query.lotacao_id) : undefined;
      const lotacao_id = raw != null && !Number.isNaN(raw) ? raw : undefined;
      ok(res, 'Regras listadas.', await funcaoPatenteService.listar(lotacao_id, prisma));
    } catch (e) {
      next(e);
    }
  },
  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ok(res, 'Regra criada.', await funcaoPatenteService.criar(req.body, prisma), 201);
    } catch (e) {
      handle(res, next, e);
    }
  },
  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ok(res, 'Regra atualizada.', await funcaoPatenteService.atualizar(Number(req.params.id), req.body, prisma));
    } catch (e) {
      handle(res, next, e);
    }
  },
  async remover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await funcaoPatenteService.remover(Number(req.params.id), prisma);
      ok(res, 'Regra removida.', null);
    } catch (e) {
      handle(res, next, e);
    }
  },
};
