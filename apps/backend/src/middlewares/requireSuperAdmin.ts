import type { RequestHandler } from 'express';
import { fail } from '../utils/response.js';

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  if (!req.user?.is_super_admin) return fail(res, 'Acesso restrito a super-admin.', 403);
  next();
};
