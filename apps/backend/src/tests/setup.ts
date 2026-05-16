import 'dotenv/config';

// Ensure que o PrismaClient default (config/db.ts) também aponte pro banco de teste,
// caso contrário middlewares que usam o client de produção bateriam em escalas_dev.
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { testPrisma, resetDb } from './helpers/db.js';

beforeAll(() => {
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
    stdio: 'inherit',
  });
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
