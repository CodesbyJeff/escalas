import { z } from 'zod';

// status é validado no middleware (422 se fora do enum). A obrigatoriedade da
// justificativa ao rejeitar é checada no service (para o teste de service cobrir a regra).
export const validarEscalaSchema = z.object({
  status: z.enum(['aprovada', 'rejeitada']),
  justificativa: z.string().trim().min(1).max(500).optional(),
});

export type ValidarEscalaInput = z.infer<typeof validarEscalaSchema>;
