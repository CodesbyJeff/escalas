import type { RequestHandler } from 'express';
import { verifyAccess } from '../config/jwt.js';
import { prisma } from '../config/db.js';
import { fail } from '../utils/response.js';

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return fail(res, 'Não autenticado.', 401);

  try {
    const payload = verifyAccess(header.slice(7));
    const user = await prisma.user.findUnique({ where: { id: payload.user_id } });
    if (!user || !user.ativo) return fail(res, 'Usuário inválido.', 401);
    req.user = { id: user.id, cpf: user.cpf, is_super_admin: user.is_super_admin };
    next();
  } catch {
    return fail(res, 'Token inválido.', 401);
  }
};
