import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

async function run(): Promise<void> {
  if (!env.ADMIN_LOCAL_PASSWORD) {
    logger.warn('admin_local_seeder_skipped_no_password');
    return;
  }
  const hash = await bcrypt.hash(env.ADMIN_LOCAL_PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { cpf: env.ADMIN_LOCAL_CPF } });
  const data = {
    nome: env.ADMIN_LOCAL_NOME,
    is_super_admin: true,
    ativo: true,
    senha_hash: hash,
    last_sync_at: new Date(),
  };
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data });
    logger.info('admin_local_updated', { cpf: env.ADMIN_LOCAL_CPF });
  } else {
    await prisma.user.create({ data: { cpf: env.ADMIN_LOCAL_CPF, ...data } });
    logger.info('admin_local_created', { cpf: env.ADMIN_LOCAL_CPF });
  }
}

run()
  .catch((e) => { logger.error('admin_local_seeder_failed', { err: (e as Error).message }); process.exit(1); })
  .finally(() => prisma.$disconnect());
