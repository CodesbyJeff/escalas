import type { RequestHandler } from 'express';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';
import type { Role } from '@escalas/shared-types';

// Carrega o layout por :id e valida o papel do usuário na lotação dele.
export function requireTemplateAccess(roles: Role[]): RequestHandler {
  return async (req, res, next) => {
    if (!req.user) return fail(res, 'Não autenticado.', 401);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 'id inválido.', 422);
    const layout = await prisma.templateLotacao.findUnique({ where: { id }, select: { id: true, lotacao_id: true } });
    if (!layout) return fail(res, 'Layout não encontrado.', 404);
    if (!req.user.is_super_admin) {
      const role = await prisma.userRole.findFirst({ where: { user_id: req.user.id, role: { in: roles }, lotacao_id: layout.lotacao_id } });
      if (!role) return fail(res, 'Sem permissão para esse layout.', 403);
    }
    next();
  };
}
