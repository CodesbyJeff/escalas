import type { RequestHandler } from 'express';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      escala?: { id: number; lotacao_id: number; status: string };
    }
  }
}

export const requireEscalaAccess: RequestHandler = async (req, res, next) => {
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
      where: { user_id: req.user.id, role: 'ESCALANTE', lotacao_id: escala.lotacao_id },
    });
    if (!role) return fail(res, 'Sem permissão para essa escala.', 403);
  }

  req.escala = escala;
  next();
};
