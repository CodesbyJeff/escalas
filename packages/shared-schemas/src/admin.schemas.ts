import { z } from 'zod';
import { ROLES } from '@escalas/shared-types';

export const atribuirRoleSchema = z.object({
  user_id: z.number().int().positive(),
  role: z.enum(ROLES),
  lotacao_id: z.number().int().positive().nullable(),
});

export type AtribuirRoleInput = z.infer<typeof atribuirRoleSchema>;
