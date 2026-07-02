import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

interface PatenteData {
  id: number;
  forca_id: number;
  sigla: string;
  nome: string;
  ordem: number;
}

async function run(): Promise<void> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(dir, 'data/patentes.json'), 'utf-8');
  const patentes: PatenteData[] = JSON.parse(raw);

  for (const p of patentes) {
    await prisma.patente.upsert({ where: { id: p.id }, update: p, create: p });
  }

  logger.info('seeder_patentes_done', { total: patentes.length });
}

run()
  .catch((e) => {
    logger.error('seeder_patentes_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
