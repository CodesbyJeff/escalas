import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

interface SuperAdminSeed {
  matricula: string;
  cpf_placeholder: string;
  nome: string;
}

async function run(): Promise<void> {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(dir, 'data/super-admins.json'), 'utf-8');
  const admins: SuperAdminSeed[] = JSON.parse(raw);

  for (const a of admins) {
    const existing = await prisma.user.findUnique({ where: { matricula: a.matricula } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { is_super_admin: true },
      });
      logger.info('super_admin_promoted', { matricula: a.matricula });
    } else {
      await prisma.user.create({
        data: {
          cpf: a.cpf_placeholder,
          matricula: a.matricula,
          nome: a.nome,
          is_super_admin: true,
          ativo: true,
          last_sync_at: new Date(),
        },
      });
      logger.info('super_admin_created_placeholder', { matricula: a.matricula });
    }
  }
}

run()
  .catch((e) => {
    logger.error('seeder_super_admins_failed', { err: (e as Error).message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
