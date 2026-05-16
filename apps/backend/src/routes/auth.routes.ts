import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, refreshSchema } from '@escalas/shared-schemas';

const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true });

export const authRoutes = Router();

authRoutes.post('/login', loginLimiter, validate(loginSchema), authController.login);
authRoutes.post('/refresh', validate(refreshSchema), authController.refresh);
authRoutes.get('/me', authMiddleware, authController.me);
