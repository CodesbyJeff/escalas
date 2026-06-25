// apps/backend/src/controllers/me.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { ok, fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';
import { meServicosQuerySchema } from '@escalas/shared-schemas';
import { meService } from '../services/me.service.js';

function handle(res: Response, next: NextFunction, e: unknown): void {
  if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
  next(e);
}

function diaUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}
function hojeUtc(): Date {
  return diaUtc(new Date().toISOString().slice(0, 10));
}

export const meController = {
  // GET /api/v1/me/servicos?from&to — serviços previstos do militar autenticado.
  async servicos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = meServicosQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        fail(res, parsed.error.errors[0]?.message ?? 'Query inválida', 422);
        return;
      }
      const from = parsed.data.from ? diaUtc(parsed.data.from) : hojeUtc();
      const to = parsed.data.to ? diaUtc(parsed.data.to) : new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
      if (to < from) { fail(res, 'Intervalo inválido: "to" anterior a "from".', 422); return; }
      const lista = await meService.listarMeusServicos(req.user!.id, from, to, prisma);
      ok(res, 'Meus serviços listados.', lista);
    } catch (e) { handle(res, next, e); }
  },
};
