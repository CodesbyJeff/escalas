import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { ehUsuarioSeedTeste } from '../utils/seedData.js';
import { logger } from '../utils/logger.js';

interface HigieneOpts {
  nodeEnv: string;
  confirm: boolean;
  lotacaoTesteId: number; // lotação real onde os papéis de teste do Admin serão recriados
}

// Acabamento pós reset-sisbom: (1) remove usuários seed-teste órfãos (não vieram do
// SISBOM e não são super-admin); (2) reatribui ESCALANTE/GESTOR/FISCAL do primeiro
// super-admin a uma lotação real, para exercitar os fluxos com dados reais.
export async function higieneDados(prismaClient: PrismaClient, opts: HigieneOpts): Promise<void> {
  if (opts.nodeEnv === 'production' || !opts.confirm) {
    throw new Error('higiene-dados: recusado (produção ou sem --yes).');
  }
  const lot = await prismaClient.lotacao.findUnique({ where: { id: opts.lotacaoTesteId } });
  if (!lot || lot.sisbom_ref == null) {
    throw new Error(`higiene-dados: lotação de teste ${opts.lotacaoTesteId} não é uma lotação real (com sisbom_ref).`);
  }
  await prismaClient.$transaction(async (tx) => {
    const users = await tx.user.findMany({ select: { id: true, sisbom_id: true, is_super_admin: true } });
    const seedIds = users.filter(ehUsuarioSeedTeste).map((u) => u.id);
    if (seedIds.length) {
      await tx.userRole.deleteMany({ where: { user_id: { in: seedIds } } });
      await tx.userLotacao.deleteMany({ where: { user_id: { in: seedIds } } });
      await tx.user.deleteMany({ where: { id: { in: seedIds } } });
    }
    const admin = await tx.user.findFirst({ where: { is_super_admin: true }, orderBy: { id: 'asc' } });
    if (admin) {
      for (const role of ['ESCALANTE', 'GESTOR', 'FISCAL'] as const) {
        await tx.userRole.upsert({
          where: { user_id_role_lotacao_id: { user_id: admin.id, role, lotacao_id: opts.lotacaoTesteId } },
          update: {},
          create: { user_id: admin.id, role, lotacao_id: opts.lotacaoTesteId, created_by: admin.id },
        });
      }
    }
    logger.info('higiene_dados_done', { removidos: seedIds.length, admin_id: admin?.id, lotacao_teste: opts.lotacaoTesteId });
  });
}

const isMain =
  process.argv[1] != null &&
  /higieneDados\.(ts|js)$/.test(process.argv[1]) &&
  !process.env.VITEST;

if (isMain) {
  const lotArg = process.argv.find((a) => a.startsWith('--lotacao='));
  const lotacaoTesteId = lotArg ? Number(lotArg.split('=')[1]) : 174; // 1º SGB/1º GBM (NATAL)
  higieneDados(prisma, { nodeEnv: env.NODE_ENV, confirm: process.argv.includes('--yes'), lotacaoTesteId })
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error('higiene_dados_failed', { err: (e as Error).message });
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
