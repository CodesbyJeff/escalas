import { z } from 'zod';

export const atribuirRoleSchema = z.object({
  user_id: z.number().int().positive(),
  role: z.enum(['ESCALANTE', 'MILITAR', 'GESTOR']),
  lotacao_id: z.number().int().positive().nullable(),
});

export type AtribuirRoleInput = z.infer<typeof atribuirRoleSchema>;
