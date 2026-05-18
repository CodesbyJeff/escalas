import { z } from 'zod';

const horarioHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato esperado HH:mm');

export const vagaSugeridaInputSchema = z.object({
  funcao: z.string().trim().min(1, 'Função obrigatória').max(60),
  quantidade_sugerida: z.number().int().positive().max(50),
});

export const guarnicaoTemplateInputSchema = z.object({
  sigla: z.string().trim().min(1).max(20),
  atividade: z.string().trim().min(1).max(40),
  turno_padrao_inicio: horarioHHmm,
  turno_padrao_fim: horarioHHmm,
  ordem: z.number().int().nonnegative(),
  vagas_sugeridas: z.array(vagaSugeridaInputSchema).min(1, 'Pelo menos uma vaga sugerida'),
});

export const upsertTemplateLotacaoSchema = z.object({
  guarnicoes: z.array(guarnicaoTemplateInputSchema).min(1, 'Pelo menos uma guarnição'),
});

export type VagaSugeridaInput = z.infer<typeof vagaSugeridaInputSchema>;
export type GuarnicaoTemplateInput = z.infer<typeof guarnicaoTemplateInputSchema>;
export type UpsertTemplateLotacaoInput = z.infer<typeof upsertTemplateLotacaoSchema>;
