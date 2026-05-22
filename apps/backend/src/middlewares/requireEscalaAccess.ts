import type { RequestHandler } from 'express';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';
import type { Role } from '@escalas/shared-types';

// Carrega a escala por :id, anexa em req.escala e valida o papel do usuário na lotação dela.
// `roles` define quais papéis são aceitos para a rota (super-admin sempre passa).
export function requireEscalaAccess(roles: Role[] = ['ESCALANTE']): RequestHandler {
  return async (req, res, next) => {
    if (!req.user) return fail(res, 'Não autenticado.', 401);
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return fail(res, 'id inválido.', 422);

    const escala = await prisma.escala.findUnique({
      where: { id },
      select: { id: true, lotacao_id: true, status: true },
    });
    if (!escala) return fail(res, 'Escala não encontrada.', 404);

    if (!req.user.is_super_admin) {
      const role = await prisma.userRole.findFirst({
        where: { user_id: req.user.id, role: { in: roles }, lotacao_id: escala.lotacao_id },
      });
      if (!role) return fail(res, 'Sem permissão para essa escala.', 403);
    }

    req.escala = escala;
    next();
  };
}
