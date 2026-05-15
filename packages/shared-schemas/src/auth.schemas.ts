import { z } from 'zod';

export const loginSchema = z.object({
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
