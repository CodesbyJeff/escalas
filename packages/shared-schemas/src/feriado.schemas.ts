import { z } from 'zod';

export const FERIADO_TIPOS = ['nacional', 'estadual', 'municipal', 'facultativo'] as const;

export const criarFeriadoSchema = z.object({
  data: z.string().date('Data deve estar no formato YYYY-MM-DD'),
  descricao: z.string().trim().min(1, 'Descrição obrigatória').max(120, 'Descrição muito longa'),
  tipo: z.enum(FERIADO_TIPOS).default('estadual'),
});

export const atualizarFeriadoSchema = z
  .object({
    data: z.string().date('Data deve estar no formato YYYY-MM-DD').optional(),
    descricao: z.string().trim().min(1, 'Descrição obrigatória').max(120, 'Descrição muito longa').optional(),
    tipo: z.enum(FERIADO_TIPOS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Informe ao menos um campo para atualizar.' });

export type CriarFeriadoInput = z.infer<typeof criarFeriadoSchema>;
export type AtualizarFeriadoInput = z.infer<typeof atualizarFeriadoSchema>;
