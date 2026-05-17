import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../utils/response.js';
import { adminService } from '../services/admin.service.js';
import { HttpError } from '../utils/errors.js';
import { syncService } from '../services/sync.service.js';
import { prisma } from '../config/db.js';

export const adminController = {
  async atribuirRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const r = await adminService.atribuirRole(req.body, req.user!.id, prisma);
      ok(res, 'Role atribuída.', r, 200);
    } catch (e) {
      if (e instanceof HttpError) {
        fail(res, e.message, e.status);
        return;
      }
      next(e);
    }
  },

  async removerRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await adminService.removerRole(Number(req.params.id), prisma);
      ok(res, 'Role removida.', null);
    } catch (e) {
      next(e);
    }
  },

  async listarUsuarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const lotacao_id = req.query.lotacao_id ? Number(req.query.lotacao_id) : undefined;
      const list = await adminService.listarUsuarios({ q, lotacao_id }, prisma);
      ok(res, 'Usuários listados.', list);
    } catch (e) {
      next(e);
    }
  },

  async resync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await syncService.runOnce(prisma);
      ok(res, 'Resync disparado.', null);
    } catch (e) {
      next(e);
    }
  },

  async bulkSync(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.syncCursor.deleteMany();
      await syncService.runOnce(prisma);
      ok(res, 'Bulk sync concluído.', null);
    } catch (e) {
      next(e);
    }
  },
};
