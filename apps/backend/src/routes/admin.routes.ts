import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { requireSuperAdmin } from '../middlewares/requireSuperAdmin.js';
import { validate } from '../middlewares/validate.js';
import { atribuirRoleSchema } from '@escalas/shared-schemas';
import { adminController } from '../controllers/admin.controller.js';

export const adminRoutes = Router();

adminRoutes.use(authMiddleware, requireSuperAdmin);
adminRoutes.get('/usuarios', adminController.listarUsuarios);
adminRoutes.post('/roles', validate(atribuirRoleSchema), adminController.atribuirRole);
adminRoutes.delete('/roles/:id', adminController.removerRole);
adminRoutes.post('/resync', adminController.resync);
adminRoutes.post('/bulk-sync', adminController.bulkSync);
