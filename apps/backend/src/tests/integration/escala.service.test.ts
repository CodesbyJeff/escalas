import { describe, it, expect } from 'vitest';
import { testPrisma } from '../helpers/db.js';
import { escalaService } from '../../services/escala.service.js';

async function seedLotacao(id = 800) {
  return testPrisma.lotacao.create({
    data: { id, sigla: `L${id}`, nome: 'Lot', nivel: 3, operacional: true },
  });
}
async function seedUser(cpf: string) {
  return testPrisma.user.create({ data: { cpf, nome: 'U', last_sync_at: new Date() } });
}
async function seedTemplate(lotacao_id: number, criado_por_id: number) {
  return testPrisma.templateLotacao.create({
    data: {
      lotacao_id,
      criado_por_id,
      guarnicoes: {
        create: [{
          sigla: 'ABT-01', atividade: 'incendio',
          turno_padrao_inicio: '07:00', turno_padrao_fim: '19:00', ordem: 0,
          vagas_sugeridas: { create: [
            { funcao: 'comandante', quantidade_sugerida: 1 },
            { funcao: 'motorista', quantidade_sugerida: 2 },
          ] },
        }],
      },
    },
  });
}

describe('escalaService.criar', () => {
  it('gera dias do mês × template com vagas vazias', async () => {
    const lot = await seedLotacao();
    const user = await seedUser('20202020202');
    await seedTemplate(lot.id, user.id);

    const escala = await escalaService.criar(
      { lotacao_id: lot.id, mes: 4, ano: 2026 },
      user.id,
      testPrisma,
    );

    expect(escala.status).toBe('rascunho');
    const dias = await testPrisma.escalaDia.count({ where: { escala_id: escala.id } });
    expect(dias).toBe(30); // abril
    const guarnicoes = await testPrisma.escalaGuarnicao.count();
    expect(guarnicoes).toBe(30);
    const vagas = await testPrisma.vaga.count();
    expect(vagas).toBe(90); // (1 comandante + 2 motorista) × 30 dias
    const umaVaga = await testPrisma.vaga.findFirst();
    expect(umaVaga!.militar_id).toBeNull();
    expect(umaVaga!.turno_inicio).toBe('07:00');
  });

  it('bloqueia (409) se lotação não tem template', async () => {
    const lot = await seedLotacao(801);
    const user = await seedUser('30303030303');
    await expect(
      escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('bloqueia (409) escala duplicada no mesmo mês/ano', async () => {
    const lot = await seedLotacao(802);
    const user = await seedUser('40404040404');
    await seedTemplate(lot.id, user.id);
    await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    await expect(
      escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('registra AuditLog de criação', async () => {
    const lot = await seedLotacao(803);
    const user = await seedUser('50505050505');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    const logs = await testPrisma.auditLog.findMany({ where: { entidade: 'Escala', entidade_id: escala.id, acao: 'criar' } });
    expect(logs).toHaveLength(1);
  });
});

describe('escalaService.listar / getDetalhe / getMes', () => {
  async function escalaPronta(lotId: number, cpf: string) {
    const lot = await seedLotacao(lotId);
    const user = await seedUser(cpf);
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    return { lot, user, escala };
  }

  it('listar filtra por lotacao_id e status', async () => {
    const { lot } = await escalaPronta(810, '11111111111');
    const lista = await escalaService.listar({ lotacao_id: lot.id, status: 'rascunho' }, testPrisma);
    expect(lista).toHaveLength(1);
    const vazia = await escalaService.listar({ lotacao_id: lot.id, status: 'aprovada' }, testPrisma);
    expect(vazia).toHaveLength(0);
  });

  it('getDetalhe traz dias com guarnições e vagas', async () => {
    const { escala } = await escalaPronta(811, '22222222222');
    const det = await escalaService.getDetalhe(escala.id, testPrisma);
    expect(det!.dias).toHaveLength(30);
    expect(det!.dias[0]!.guarnicoes[0]!.vagas).toHaveLength(3);
  });

  it('getDetalhe retorna null se não existe', async () => {
    expect(await escalaService.getDetalhe(999999, testPrisma)).toBeNull();
  });

  it('getMes resume status por dia', async () => {
    const { escala } = await escalaPronta(812, '33333333333');
    const mes = await escalaService.getMes(escala.id, testPrisma);
    expect(mes!.dias).toHaveLength(30);
    expect(mes!.dias[0]).toMatchObject({ vagas_total: 3, vagas_preenchidas: 0 });
  });
});

import type { PutDiaInput } from '@escalas/shared-schemas';

describe('escalaService.putDia', () => {
  async function escalaComDia(lotId: number, cpf: string) {
    const lot = await seedLotacao(lotId);
    const user = await seedUser(cpf);
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    const militar = await seedUser(`9${cpf}`.slice(0, 11));
    return { lot, user, escala, militar, data: '2026-04-01' };
  }

  const guarnicaoBase = (militar_id: number | null) => ({
    sigla: 'ABT-01', atividade: 'incendio', viatura_id: null,
    turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
    vagas: [{ funcao: 'comandante', militar_id, turno_inicio: '07:00', turno_fim: '19:00' }],
  });

  it('substitui guarnições do dia e atribui militar', async () => {
    const { escala, militar, data } = await escalaComDia(820, '12312312312');
    const input: PutDiaInput = { observacoes: 'teste', guarnicoes: [guarnicaoBase(militar.id)] };
    const dia = await escalaService.putDia(escala.id, data, input, escala.criado_por_id, testPrisma);
    expect(dia.guarnicoes).toHaveLength(1);
    expect(dia.guarnicoes[0]!.vagas[0]!.militar_id).toBe(militar.id);
    expect(dia.observacoes).toBe('teste');
  });

  it('barra (422) militar em duas vagas sobrepostas', async () => {
    const { escala, militar, data } = await escalaComDia(821, '32132132132');
    const input: PutDiaInput = {
      guarnicoes: [{
        sigla: 'ABT-01', atividade: 'incendio', viatura_id: null,
        turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
        vagas: [
          { funcao: 'comandante', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' },
          { funcao: 'motorista', militar_id: militar.id, turno_inicio: '12:00', turno_fim: '15:00' },
        ],
      }],
    };
    await expect(
      escalaService.putDia(escala.id, data, input, escala.criado_por_id, testPrisma),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('404 se o dia não pertence à escala', async () => {
    const { escala } = await escalaComDia(822, '45645645645');
    const input: PutDiaInput = { guarnicoes: [guarnicaoBase(null)] };
    await expect(
      escalaService.putDia(escala.id, '2026-05-01', input, escala.criado_por_id, testPrisma),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('registra AuditLog de edição com antes/depois', async () => {
    const { escala, data } = await escalaComDia(823, '65465465465');
    const input: PutDiaInput = { guarnicoes: [guarnicaoBase(null)] };
    await escalaService.putDia(escala.id, data, input, escala.criado_por_id, testPrisma);
    const logs = await testPrisma.auditLog.findMany({ where: { entidade: 'EscalaDia', acao: 'editar' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.payload_depois).not.toBeNull();
  });
});

describe('escalaService.duplicarDia', () => {
  it('copia guarnições/vagas de um dia para outro', async () => {
    const lot = await seedLotacao(830);
    const user = await seedUser('70707070707');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    const militar = await seedUser('80808080808');

    await escalaService.putDia(escala.id, '2026-04-01', {
      guarnicoes: [{
        sigla: 'ABT-01', atividade: 'incendio', viatura_id: null,
        turno_inicio: '07:00', turno_fim: '19:00', ordem: 0,
        vagas: [{ funcao: 'comandante', militar_id: militar.id, turno_inicio: '07:00', turno_fim: '19:00' }],
      }],
    }, user.id, testPrisma);

    const dia02 = await escalaService.duplicarDia(escala.id, '2026-04-02', '2026-04-01', user.id, testPrisma);
    expect(dia02.guarnicoes).toHaveLength(1);
    expect(dia02.guarnicoes[0]!.vagas[0]!.militar_id).toBe(militar.id);
  });

  it('404 se o dia de origem não existe', async () => {
    const lot = await seedLotacao(831);
    const user = await seedUser('90909090909');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    await expect(
      escalaService.duplicarDia(escala.id, '2026-04-02', '2026-05-01', user.id, testPrisma),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('escalaService.publicar / versões', () => {
  async function pronta(lotId: number, cpf: string) {
    const lot = await seedLotacao(lotId);
    const user = await seedUser(cpf);
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    return { user, escala };
  }

  it('publicar cria versão 1 e seta em_validacao', async () => {
    const { user, escala } = await pronta(840, '11211211211');
    const v = await escalaService.publicar(escala.id, user.id, testPrisma);
    expect(v.versao).toBe(1);
    const e = await testPrisma.escala.findUnique({ where: { id: escala.id } });
    expect(e!.status).toBe('em_validacao');
    expect(e!.publicado_em).not.toBeNull();
  });

  it('republicar incrementa para versão 2', async () => {
    const { user, escala } = await pronta(841, '22322322322');
    await escalaService.publicar(escala.id, user.id, testPrisma);
    const v2 = await escalaService.publicar(escala.id, user.id, testPrisma);
    expect(v2.versao).toBe(2);
  });

  it('snapshot contém os dias', async () => {
    const { user, escala } = await pronta(842, '33433433433');
    const v = await escalaService.publicar(escala.id, user.id, testPrisma);
    const conteudo = v.conteudo as { dias: unknown[] };
    expect(conteudo.dias).toHaveLength(30);
  });

  it('listarVersoes e getVersao', async () => {
    const { user, escala } = await pronta(843, '44544544544');
    await escalaService.publicar(escala.id, user.id, testPrisma);
    const lista = await escalaService.listarVersoes(escala.id, testPrisma);
    expect(lista).toHaveLength(1);
    const v1 = await escalaService.getVersao(escala.id, 1, testPrisma);
    expect(v1!.versao).toBe(1);
  });
});

describe('escalaService.deletar', () => {
  it('deleta escala em rascunho', async () => {
    const lot = await seedLotacao(850);
    const user = await seedUser('55655655655');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    await escalaService.deletar(escala.id, user.id, testPrisma);
    expect(await testPrisma.escala.findUnique({ where: { id: escala.id } })).toBeNull();
  });

  it('409 ao deletar escala já publicada', async () => {
    const lot = await seedLotacao(851);
    const user = await seedUser('66766766766');
    await seedTemplate(lot.id, user.id);
    const escala = await escalaService.criar({ lotacao_id: lot.id, mes: 4, ano: 2026 }, user.id, testPrisma);
    await escalaService.publicar(escala.id, user.id, testPrisma);
    await expect(
      escalaService.deletar(escala.id, user.id, testPrisma),
    ).rejects.toMatchObject({ status: 409 });
  });
});
