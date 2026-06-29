import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma, resetDb } from '../helpers/db.js';
import { resumoServicoService } from '../../services/resumoServico.service.js';

beforeEach(resetDb);

// Escala set/2026. Datas: 04=sex(semana), 05=sáb(fds), 07=Independência(feriado nacional),
// 08=ter(semana), 15=ter + Feriado-tabela(feriado). Militar A em todas (5); Militar B só 08 (1).
async function cenario() {
  const lot = await testPrisma.lotacao.create({ data: { id: 830, sigla: 'L830', nome: 'Lot 830', nivel: 3, operacional: true } });
  const a = await testPrisma.user.create({ data: { cpf: '83000000001', nome: 'Alfa', posto: 'SD', last_sync_at: new Date() } });
  const b = await testPrisma.user.create({ data: { cpf: '83000000002', nome: 'Bravo', posto: 'CB', last_sync_at: new Date() } });
  const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 9, ano: 2026, status: 'em_validacao', criado_por_id: a.id, publicado_em: new Date() } });
  await testPrisma.feriado.create({ data: { data: new Date('2026-09-15T00:00:00.000Z'), descricao: 'Feriado estadual teste', tipo: 'estadual' } });
  async function vaga(dataISO: string, militarId: number) {
    const dia = await testPrisma.escalaDia.upsert({
      where: { escala_id_data: { escala_id: escala.id, data: new Date(`${dataISO}T00:00:00.000Z`) } },
      update: {}, create: { escala_id: escala.id, data: new Date(`${dataISO}T00:00:00.000Z`) },
    });
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: militarId, turno_inicio: '07:00', turno_fim: '19:00' } });
  }
  for (const d of ['2026-09-04','2026-09-05','2026-09-07','2026-09-08','2026-09-15']) await vaga(d, a.id);
  await vaga('2026-09-08', b.id);
  return { escala, a, b };
}

describe('resumoServicoService.calcular', () => {
  it('classifica semana × fim-de-semana/feriado (sáb, feriado nacional, feriado da tabela)', async () => {
    const { escala, a } = await cenario();
    const r = await resumoServicoService.calcular(escala.id, testPrisma);
    const alfa = r.find((x) => x.militar_id === a.id)!;
    expect(alfa.total).toBe(5);
    expect(alfa.semana).toBe(2);            // 04 (sex) + 08 (ter)
    expect(alfa.fim_semana_feriado).toBe(3); // 05 (sáb) + 07 (Independência) + 15 (tabela)
  });

  it('lista um item por militar, ordenado por nome', async () => {
    const { escala } = await cenario();
    const r = await resumoServicoService.calcular(escala.id, testPrisma);
    expect(r.map((x) => x.nome)).toEqual(['Alfa', 'Bravo']);
    expect(r.find((x) => x.nome === 'Bravo')!.total).toBe(1);
  });

  it('feriado facultativo nacional (Corpus Christi, quinta) conta como fim_semana_feriado', async () => {
    // Decisão intencional: facultativos nacionais (Carnaval/Corpus Christi) contam como feriado.
    const lot = await testPrisma.lotacao.create({ data: { id: 831, sigla: 'L831', nome: 'Lot 831', nivel: 3, operacional: true } });
    const m = await testPrisma.user.create({ data: { cpf: '83100000001', nome: 'Charlie', posto: 'SD', last_sync_at: new Date() } });
    const escala = await testPrisma.escala.create({ data: { lotacao_id: lot.id, mes: 6, ano: 2026, status: 'em_validacao', criado_por_id: m.id, publicado_em: new Date() } });
    const dia = await testPrisma.escalaDia.create({ data: { escala_id: escala.id, data: new Date('2026-06-04T00:00:00.000Z') } }); // Corpus Christi 2026 (quinta)
    const g = await testPrisma.escalaGuarnicao.create({ data: { escala_dia_id: dia.id, sigla: 'G', atividade: 'A', turno_inicio: '07:00', turno_fim: '19:00', ordem: 0 } });
    await testPrisma.vaga.create({ data: { escala_guarnicao_id: g.id, funcao: 'F', militar_id: m.id, turno_inicio: '07:00', turno_fim: '19:00' } });
    const r = await resumoServicoService.calcular(escala.id, testPrisma);
    expect(r[0]!.total).toBe(1);
    expect(r[0]!.fim_semana_feriado).toBe(1);
    expect(r[0]!.semana).toBe(0);
  });
});
