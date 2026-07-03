import { z } from 'zod';

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data YYYY-MM-DD');

export const preenchimentoInputSchema = z.object({
  data_ini: dataISO,
  data_fim: dataISO,
  descanso_horas: z.number().int().min(0).max(336).optional(),
});

export type PreenchimentoInput = z.infer<typeof preenchimentoInputSchema>;
