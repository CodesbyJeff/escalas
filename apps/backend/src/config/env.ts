import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SISBOM_AUTH_URL: z.string().url(),
  SISBOM_EXTERNAL_BASE_URL: z.string().url(),
  SISBOM_API_KEY: z.string().min(1),
  SYNC_INTERVAL_CRON: z.string().default('*/5 * * * *'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
