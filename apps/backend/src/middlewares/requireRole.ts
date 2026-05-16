import type { RequestHandler } from 'express';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';
import type { Role } from '@escalas/shared-types';

export function requireRole(roles: Role[], opts?: { lotacaoIdFrom?: 'param' | 'body' | 'query'; key?: string }): RequestHandler {
  return async (req, res, next) => {
    if (!req.user) return fail(res, 'Não autenticado.', 401);
    if (req.user.is_super_admin) return next();

    const userRoles = await prisma.userRole.findMany({ where: { user_id: req.user.id } });
    if (!userRoles.some((r) => roles.includes(r.role))) {
      return fail(res, 'Sem permissão para essa ação.', 403);
    }

    if (opts?.lotacaoIdFrom && opts.key) {
      const raw =
        opts.lotacaoIdFrom === 'param' ? req.params[opts.key]
        : opts.lotacaoIdFrom === 'body' ? req.body?.[opts.key]
        : req.query[opts.key];
      const lotacaoId = Number(raw);
      if (Number.isNaN(lotacaoId)) return fail(res, 'lotacao_id obrigatório.', 422);
      const ok = userRoles.some(
        (r) => roles.includes(r.role) && r.lotacao_id === lotacaoId,
      );
      if (!ok) return fail(res, 'Sem permissão para essa lotação.', 403);
    }
    next();
  };
}
