import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';

async function seed() {
  const patentes = [
    { id: 12, forca_id: 0, sigla: '1º SGT', nome: '1º Sargento', ordem: 12 },
    { id: 17, forca_id: 0, sigla: 'SD', nome: 'Soldado', ordem: 17 },
  ];
  for (const p of patentes) {
    await testPrisma.patente.upsert({ where: { id: p.id }, update: p, create: p });
  }
}

describe('seed de Patente', () => {
  beforeEach(async () => { await resetDb(); });

  it('é idempotente (rodar 2x mantém a contagem)', async () => {
    await seed();
    await seed();
    expect(await testPrisma.patente.count()).toBe(2);
    const sd = await testPrisma.patente.findUnique({ where: { id: 17 } });
    expect(sd!.sigla).toBe('SD');
  });
});
