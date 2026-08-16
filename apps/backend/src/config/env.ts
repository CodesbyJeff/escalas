import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** Dev do Vite (5173) e preview do build (4173). */
const DEV_ORIGINS = 'http://localhost:5173,http://localhost:4173';

function splitOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    DATABASE_URL_TEST: z.string().url().optional(),
    JWT_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'Formato inválido (use 30s, 15m, 8h, 7d)')
      .default('8h'),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'Formato inválido (use 30s, 15m, 8h, 7d)')
      .default('7d'),
    // Lista separada por vírgula. Obrigatória em produção (ver superRefine).
    ALLOWED_ORIGINS: z.string().optional(),
    SISBOM_AUTH_URL: z.string().url(),
    SISBOM_EXTERNAL_BASE_URL: z.string().url(),
    SISBOM_API_KEY: z.string().min(1),
    SYNC_INTERVAL_CRON: z.string().default('*/5 * * * *'),
    ADMIN_LOCAL_CPF: z.string().default('99999999900'),
    ADMIN_LOCAL_NOME: z.string().default('Admin Operacional Escalas'),
    ADMIN_LOCAL_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;
    if (splitOrigins(val.ALLOWED_ORIGINS ?? '').length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOWED_ORIGINS'],
        message:
          'ALLOWED_ORIGINS é obrigatória em produção (lista de origens separada por vírgula)',
      });
    }
  });

export type Env = z.infer<typeof envSchema> & { origins: string[] };

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(raw);
  // Em produção o superRefine já garantiu lista não-vazia; o default de dev
  // nunca vale lá, para não reabrir o buraco por acidente.
  const efetivo =
    parsed.ALLOWED_ORIGINS ?? (parsed.NODE_ENV === 'production' ? '' : DEV_ORIGINS);
  return { ...parsed, origins: splitOrigins(efetivo) };
}

export const env = parseEnv(process.env);
