import { PrismaClient } from '@prisma/client';

export const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST } },
});

export async function resetDb(): Promise<void> {
  await testPrisma.templateLotacao.deleteMany(); // cascateia guarnicao/vaga
  await testPrisma.userRole.deleteMany();
  await testPrisma.userLotacao.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.lotacao.deleteMany();
  await testPrisma.syncCursor.deleteMany();
}
