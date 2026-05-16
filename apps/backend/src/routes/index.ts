import { Router } from 'express';
import { ok } from '../utils/response.js';
import { authRoutes } from './auth.routes.js';
import { adminRoutes } from './admin.routes.js';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.get('/', (_req, res) => ok(res, 'API online.', { name: 'escalas', version: 'v1' }));
