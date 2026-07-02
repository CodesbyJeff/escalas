import { z } from 'zod';

// Regra de escopo Global (sem lotacao_id) ou Lotação. A camada Layout é 2b.2 (não exposta aqui).
export const criarFuncaoPatenteSchema = z.object({
  lotacao_id: z.number().int().positive().nullable().optional(),
  funcao: z.string().min(1).max(100),
  patente_ids: z.array(z.number().int().positive()).max(72),
});

export const atualizarFuncaoPatenteSchema = z.object({
  patente_ids: z.array(z.number().int().positive()).max(72),
});

export type CriarFuncaoPatenteInput = z.infer<typeof criarFuncaoPatenteSchema>;
export type AtualizarFuncaoPatenteInput = z.infer<typeof atualizarFuncaoPatenteSchema>;
