import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

interface LotacaoData {
  id: number;
  sigla: string;
  nome: string;
  lotacao_pai_id: number | null;
  nivel: number;
  operacional: boolean;
  externo: boolean;
}

async function run(): Promise<void> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(dir, 'data/lotacoes.json'), 'utf-8');
  const lotacoes: LotacaoData[] = JSON.parse(raw);

  lotacoes.sort((a, b) => a.nivel - b.nivel);

  for (const l of lotacoes) {
    await prisma.lotacao.upsert({
      where: { id: l.id },
      update: l,
      create: l,
    });
  }

  logger.info('seeder_lotacoes_done', { total: lotacoes.length });
}

run()
  .catch((e) => {
    logger.error('seeder_lotacoes_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
