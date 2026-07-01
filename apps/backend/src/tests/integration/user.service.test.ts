import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, testPrisma } from '../helpers/db.js';
import { userService } from '../../services/user.service.js';

describe('userService.applyEvent', () => {
  it('cria user com op=create', async () => {
    await userService.applyEvent(
      {
        id: 'evt1', op: 'create', entity: 'militar', entity_id: 'abc', at: '2026-05-15T10:00:00Z',
        data: { _id: 'abc', str_cpf: '11122233344', pessoa: { str_nome: 'Fulano' }, str_matricula: '123-4', str_nomecurto: 'FUL', ativo: true },
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { cpf: '11122233344' } });
    expect(u?.nome).toBe('Fulano');
    expect(u?.sisbom_id).toBe('abc');
    expect(u?.nome_curto).toBe('FUL');
    expect(u?.matricula).toBe('1234');
  });

  it('atualiza com op=patch usando sisbom_id', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'Old', sisbom_id: 'abc', last_sync_at: new Date(), matricula: '1234' },
    });
    await userService.applyEvent(
      {
        id: 'e2', op: 'patch', entity: 'militar', entity_id: 'abc', at: '2026-05-15T11:00:00Z',
        data: { _id: 'abc', str_cpf: '11122233344', pessoa: { str_nome: 'New' } },
      },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.nome).toBe('New');
  });

  it('inativa com op=delete', async () => {
    await testPrisma.user.create({
      data: { cpf: '11122233344', nome: 'X', sisbom_id: 'abc', last_sync_at: new Date() },
    });
    await userService.applyEvent(
      { id: 'e3', op: 'delete', entity: 'militar', entity_id: 'abc', at: '2026-05-15T12:00:00Z', data: null },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'abc' } });
    expect(u?.ativo).toBe(false);
  });

  it('inativa com op=remove usando entity_id (data null)', async () => {
    await testPrisma.user.create({
      data: { cpf: '99988877766', nome: 'Y', sisbom_id: 'rem', last_sync_at: new Date() },
    });
    await userService.applyEvent(
      { id: 'e4', op: 'remove', entity: 'militar', entity_id: 'rem', at: '2026-05-15T12:00:00Z', data: null },
      testPrisma,
    );
    const u = await testPrisma.user.findUnique({ where: { sisbom_id: 'rem' } });
    expect(u?.ativo).toBe(false);
  });

  it('ignora evento de entity diferente de militar', async () => {
    await userService.applyEvent(
      { id: 'e5', op: 'create', entity: 'lotacoes', entity_id: 'L', at: '2026-05-15T10:00:00Z', data: { _id: 'L' } },
      testPrisma,
    );
    expect(await testPrisma.user.count()).toBe(0);
  });
});

const ts = new Date('2026-07-01T00:00:00.000Z');

async function seedLotacao(ref: string, nivel = 2) {
  return testPrisma.lotacao.create({
    data: { sisbom_ref: ref, sisbom_id: `id-${ref}`, sigla: ref, nome: ref, nivel },
  });
}

describe('userService.upsertFromSisbom — vínculo de lotação', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('vincula militar à lotação resolvida por ref, com nivel = lotacao.nivel', async () => {
    const lot = await seedLotacao('CTIC', 2);
    await userService.upsertFromSisbom(
      { _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'Fulano' }, _lotacao: 'CTIC', ativo: true },
      ts,
      testPrisma,
    );
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.sisbom_lotacao_ref).toBe('CTIC');
    expect(user?.lotacoes).toHaveLength(1);
    expect(user!.lotacoes[0]?.lotacao_id).toBe(lot.id);
    expect(user!.lotacoes[0]?.nivel).toBe(2);
  });

  it('troca de lotação remove o vínculo SISBOM antigo e cria o novo', async () => {
    const a = await seedLotacao('CTIC');
    const b = await seedLotacao('CFAP');
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CFAP' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.lotacoes.map((l) => l.lotacao_id)).toEqual([b.id]);
    expect(user?.lotacoes.some((l) => l.lotacao_id === a.id)).toBe(false);
  });

  it('ref inexistente localmente: militar sem vínculo, sem erro', async () => {
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'ZZZ' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    expect(user?.sisbom_lotacao_ref).toBe('ZZZ');
    expect(user?.lotacoes).toHaveLength(0);
  });

  it('preserva vínculo manual (de outra lotação) ao sincronizar', async () => {
    const manual = await seedLotacao('MANUAL');
    const ctic = await seedLotacao('CTIC');
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' } });
    await testPrisma.userLotacao.create({ data: { user_id: user!.id, lotacao_id: manual.id, nivel: 2 } });
    // re-sync mantendo a mesma lotação SISBOM
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '111', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const after = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' }, include: { lotacoes: true } });
    const ids = after!.lotacoes.map((l) => l.lotacao_id).sort();
    expect(ids).toEqual([manual.id, ctic.id].sort());
  });

  it('militar sem cpf é pulado (comportamento mantido)', async () => {
    await userService.upsertFromSisbom({ _id: 'm1', str_cpf: '', pessoa: { str_nome: 'F' }, _lotacao: 'CTIC' }, ts, testPrisma);
    const user = await testPrisma.user.findUnique({ where: { sisbom_id: 'm1' } });
    expect(user).toBeNull();
  });
});
