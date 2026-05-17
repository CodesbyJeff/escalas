import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
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
  SISBOM_AUTH_URL: z.string().url(),
  SISBOM_EXTERNAL_BASE_URL: z.string().url(),
  SISBOM_API_KEY: z.string().min(1),
  SYNC_INTERVAL_CRON: z.string().default('*/5 * * * *'),
  ADMIN_LOCAL_CPF: z.string().default('99999999900'),
  ADMIN_LOCAL_NOME: z.string().default('Admin Operacional Escalas'),
  ADMIN_LOCAL_PASSWORD: z.string().min(8).optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
