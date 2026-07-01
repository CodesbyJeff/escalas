import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { syncService } from '../services/sync.service.js';
import { logger } from '../utils/logger.js';

interface ResetOpts {
  nodeEnv: string;
  confirm: boolean;
  bulk?: (p: PrismaClient) => Promise<void>;
}

// Limpa os dados fabricados de lotação/escala e repopula do SISBOM.
export async function resetSisbomData(prismaClient: PrismaClient, opts: ResetOpts): Promise<void> {
  if (opts.nodeEnv === 'production' || !opts.confirm) {
    throw new Error('reset-sisbom: recusado (produção ou sem confirmação explícita).');
  }
  // Ordem FK-safe (mesma do tests/helpers/db.ts), preservando super-admins? Não:
  // é reset de dados sincronizados/derivados de teste. Ver spec.
  await prismaClient.auditLog.deleteMany();
  await prismaClient.validacaoEscala.deleteMany();
  await prismaClient.escalaVersao.deleteMany();
  await prismaClient.execucaoVaga.deleteMany();
  await prismaClient.escala.deleteMany();
  await prismaClient.templateLotacao.deleteMany();
  await prismaClient.userRole.deleteMany();
  await prismaClient.userLotacao.deleteMany();
  await prismaClient.lotacao.deleteMany();
  await prismaClient.syncCursor.deleteMany();

  const bulk = opts.bulk ?? syncService.bulkSnapshot;
  await bulk(prismaClient);
  logger.info('reset_sisbom_done');
}

// Entrypoint CLI (não roda quando importado nos testes).
const isMain =
  process.argv[1] != null &&
  /resetSisbomData\.(ts|js)$/.test(process.argv[1]) &&
  !process.env.VITEST;

if (isMain) {
  resetSisbomData(prisma, { nodeEnv: env.NODE_ENV, confirm: process.argv.includes('--yes') })
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error('reset_sisbom_failed', { err: (e as Error).message });
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
