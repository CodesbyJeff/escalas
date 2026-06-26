// apps/mobile/src/lib/datas.test.ts
import { proximoServico, proximos7Dias, agruparPorDia, markedDates } from './datas';

const mk = (data: string, turno = '07:00'): any => ({ vaga_id: 1, data, funcao: 'X', turno_inicio: turno, turno_fim: '19:00', guarnicao: { sigla: 'G', atividade: 'A', turno_inicio: turno, turno_fim: '19:00' }, lotacao: { id: 1, sigla: 'L', nome: 'L' } });
const servicos = [mk('2026-06-20'), mk('2026-06-26'), mk('2026-06-28'), mk('2026-07-30')];

it('proximoServico devolve o primeiro serviço >= hoje', () => {
  expect(proximoServico(servicos, '2026-06-25')?.data).toBe('2026-06-26');
  expect(proximoServico([mk('2026-06-20')], '2026-06-25')).toBeNull();
});

it('proximos7Dias filtra a janela [hoje, hoje+6]', () => {
  const r = proximos7Dias(servicos, '2026-06-25');
  expect(r.map((s) => s.data)).toEqual(['2026-06-26', '2026-06-28']);
});

it('agruparPorDia agrupa por data', () => {
  const g = agruparPorDia([mk('2026-06-26', '07:00'), mk('2026-06-26', '19:00')]);
  expect(g['2026-06-26']).toHaveLength(2);
});

it('markedDates marca cada dia com serviço', () => {
  expect(markedDates(servicos)['2026-06-26']).toEqual({ marked: true });
});
