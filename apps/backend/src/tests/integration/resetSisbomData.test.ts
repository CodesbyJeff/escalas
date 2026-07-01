import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { resetSisbomData } from '../../cli/resetSisbomData.js';

describe('resetSisbomData', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('bloqueia em produção sem a flag', async () => {
    await expect(resetSisbomData(testPrisma, { nodeEnv: 'production', confirm: false })).rejects.toThrow(/produç|confirm/i);
  });

  it('limpa lotações fabricadas e chama o bulk', async () => {
    await testPrisma.lotacao.create({ data: { id: 999, sigla: 'FAKE', nome: 'Fabricada', nivel: 1 } });
    const bulk = vi.fn().mockResolvedValue(undefined);
    await resetSisbomData(testPrisma, { nodeEnv: 'development', confirm: true, bulk });
    expect(await testPrisma.lotacao.count()).toBe(0);
    expect(bulk).toHaveBeenCalledOnce();
  });
});
