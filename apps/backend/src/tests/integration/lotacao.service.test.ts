import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { lotacaoService } from '../../services/lotacao.service.js';

const ts = new Date('2026-07-01T00:00:00.000Z');

describe('lotacaoService.upsertFromSisbom', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('cria lotação raiz por sisbom_ref, parseando nivel string', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_sigla_extenso: 'DLOF', str_nome: 'Diretoria de Log', _pai: '', nivel: '1', operacional: false, externo: false },
      ts,
      testPrisma,
    );
    const l = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    expect(l).toBeTruthy();
    expect(l?.nivel).toBe(1);
    expect(l?.lotacao_pai_id).toBeNull();
    expect(l?.sisbom_id).toBe('uuid-dlof');
  });

  it('resolve _pai (ref) para lotacao_pai_id quando o pai já existe', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-dlof', ref: 'DLOF', str_sigla: 'DLOF', str_nome: 'DLOF', _pai: '', nivel: '1' },
      ts,
      testPrisma,
    );
    const pai = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'DLOF' } });
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Centro de TI', _pai: 'DLOF', nivel: '2' },
      ts,
      testPrisma,
    );
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBe(pai?.id);
  });

  it('deixa lotacao_pai_id null quando o pai ainda não existe', async () => {
    await lotacaoService.upsertFromSisbom(
      { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Centro de TI', _pai: 'DLOF', nivel: '2' },
      ts,
      testPrisma,
    );
    const ctic = await testPrisma.lotacao.findUnique({ where: { sisbom_ref: 'CTIC' } });
    expect(ctic?.lotacao_pai_id).toBeNull();
  });

  it('atualiza (upsert) a lotação existente pelo mesmo sisbom_ref', async () => {
    const base = { _id: 'uuid-ctic', ref: 'CTIC', str_sigla: 'CTIC', str_nome: 'Nome Antigo', _pai: '', nivel: '2' };
    await lotacaoService.upsertFromSisbom(base, ts, testPrisma);
    await lotacaoService.upsertFromSisbom({ ...base, str_nome: 'Nome Novo' }, ts, testPrisma);
    const all = await testPrisma.lotacao.findMany({ where: { sisbom_ref: 'CTIC' } });
    expect(all).toHaveLength(1);
    expect(all[0]!.nome).toBe('Nome Novo');
  });
});
