import { z } from 'zod';

export const SITUACOES = ['presente', 'falta', 'substituido', 'preenchido'] as const;

export const execucaoVagaSchema = z
  .object({
    vaga_id: z.number().int().positive(),
    situacao: z.enum(SITUACOES),
    militar_executado_id: z.number().int().positive().nullable(),
    do: z.boolean().default(false),
    observacoes: z.string().trim().max(280).optional(),
  })
  .refine((v) => (v.situacao === 'falta' ? v.militar_executado_id === null : true), {
    message: 'falta não pode ter militar_executado_id',
    path: ['militar_executado_id'],
  })
  .refine(
    (v) => (v.situacao === 'substituido' || v.situacao === 'preenchido' ? v.militar_executado_id !== null : true),
    { message: 'substituído/preenchido exige militar_executado_id', path: ['militar_executado_id'] },
  );

export const putExecucaoSchema = z.object({
  vagas: z.array(execucaoVagaSchema),
});
export type PutExecucaoInput = z.infer<typeof putExecucaoSchema>;

export const validarExecucaoSchema = z
  .object({
    status: z.enum(['validada', 'rejeitada']),
    justificativa: z.string().trim().min(1).max(500).optional(),
  })
  .refine((v) => (v.status === 'rejeitada' ? !!v.justificativa : true), {
    message: 'Justificativa é obrigatória ao rejeitar.',
    path: ['justificativa'],
  });
export type ValidarExecucaoInput = z.infer<typeof validarExecucaoSchema>;
