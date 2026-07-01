import { z } from 'zod';

const horarioHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato esperado HH:mm');

export const criarEscalaSchema = z.object({
  lotacao_id: z.number().int().positive(),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2024).max(2100),
  template_id: z.number().int().positive(),
});

export const vagaInputSchema = z.object({
  funcao: z.string().trim().min(1).max(60),
  militar_id: z.number().int().positive().nullable(),
  turno_inicio: horarioHHmm,
  turno_fim: horarioHHmm,
  observacoes: z.string().trim().max(280).optional(),
});

export const guarnicaoInputSchema = z.object({
  sigla: z.string().trim().min(1).max(20),
  atividade: z.string().trim().min(1).max(40),
  viatura_id: z.string().trim().max(60).nullable().optional(),
  turno_inicio: horarioHHmm,
  turno_fim: horarioHHmm,
  ordem: z.number().int().nonnegative(),
  vagas: z.array(vagaInputSchema),
});

export const putDiaSchema = z.object({
  observacoes: z.string().trim().max(280).nullable().optional(),
  guarnicoes: z.array(guarnicaoInputSchema),
});

export const duplicarDiaSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data esperada YYYY-MM-DD'),
});

export type CriarEscalaInput = z.infer<typeof criarEscalaSchema>;
export type VagaInput = z.infer<typeof vagaInputSchema>;
export type GuarnicaoInput = z.infer<typeof guarnicaoInputSchema>;
export type PutDiaInput = z.infer<typeof putDiaSchema>;
export type DuplicarDiaInput = z.infer<typeof duplicarDiaSchema>;
