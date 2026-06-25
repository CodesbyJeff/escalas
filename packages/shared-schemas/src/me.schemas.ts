import { z } from 'zod';

const dataYMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD');

export const meServicosQuerySchema = z.object({
  from: dataYMD.optional(),
  to: dataYMD.optional(),
});
export type MeServicosQuery = z.infer<typeof meServicosQuerySchema>;
