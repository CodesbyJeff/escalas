import type { Request, Response, NextFunction } from 'express';
import { ok, fail } from '../utils/response.js';
import { authService, HttpError } from '../services/auth.service.js';
import { prisma } from '../config/db.js';
import { sisbomClient } from '../integrations/sisbom/client.js';

const deps = { prisma, sisbom: sisbomClient };

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body, deps);
      ok(res, 'Login realizado.', result);
    } catch (e) {
      if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
      next(e);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refresh(req.body.refresh_token, deps);
      ok(res, 'Token renovado.', result);
    } catch (e) {
      if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
      next(e);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.me(req.user!.id, deps);
      ok(res, 'Perfil retornado.', result);
    } catch (e) {
      if (e instanceof HttpError) { fail(res, e.message, e.status); return; }
      next(e);
    }
  },
};
