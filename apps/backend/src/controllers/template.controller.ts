import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { templateService } from '../services/template.service.js';

export const templateController = {
  async getByLotacao(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotacao_id = Number(req.params.lotacao_id);
      if (Number.isNaN(lotacao_id)) {
        fail(res, 'lotacao_id inválido.', 422);
        return;
      }
      const t = await templateService.getByLotacao(lotacao_id, prisma);
      if (!t) {
        fail(res, 'Template não configurado para essa lotação.', 404);
        return;
      }
      ok(res, 'Template obtido.', t);
    } catch (e) {
      next(e);
    }
  },

  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lotacao_id = Number(req.params.lotacao_id);
      if (Number.isNaN(lotacao_id)) {
        fail(res, 'lotacao_id inválido.', 422);
        return;
      }
      const result = await templateService.upsert(lotacao_id, req.user!.id, req.body, prisma);
      ok(res, 'Template salvo.', result, 200);
    } catch (e) {
      if (e instanceof HttpError) {
        fail(res, e.message, e.status);
        return;
      }
      next(e);
    }
  },
};
