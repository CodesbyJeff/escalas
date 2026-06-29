import { type PrismaClient } from '@prisma/client';
import type { ResumoServicoDTO } from '@escalas/shared-types';
import { NotFoundError } from '../utils/errors.js';
import { feriadosBrasil } from '../utils/feriados.js';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const resumoServicoService = {
  async calcular(escala_id: number, prisma: PrismaClient): Promise<ResumoServicoDTO[]> {
    const escala = await prisma.escala.findUnique({ where: { id: escala_id } });
    if (!escala) throw new NotFoundError('Escala não encontrada.');

    // Conjunto de feriados do mês: nacionais (feriadosBrasil) + tabela Feriado.
    // Decisão intencional: os facultativos nacionais (Carnaval, Corpus Christi) TAMBÉM
    // contam como fim_de_semana_feriado — são dias de demanda operacional pesada para o
    // CBM, equivalentes a feriado para fins de carga de serviço. Para contar só feriados
    // obrigatórios, filtrar por `f.tipo === 'nacional'` aqui.
    const inicio = new Date(Date.UTC(escala.ano, escala.mes - 1, 1));
    const fim = new Date(Date.UTC(escala.ano, escala.mes, 0)); // último dia do mês
    const feriadoSet = new Set<string>(feriadosBrasil(escala.ano).map((f) => ymd(f.data)));
    const tabela = await prisma.feriado.findMany({ where: { data: { gte: inicio, lte: fim } } });
    for (const f of tabela) feriadoSet.add(ymd(f.data));

    const vagas = await prisma.vaga.findMany({
      where: { militar_id: { not: null }, guarnicao: { dia: { escala_id } } },
      include: { guarnicao: { include: { dia: true } }, militar: true },
    });

    const acc = new Map<number, ResumoServicoDTO>();
    for (const v of vagas) {
      if (v.militar_id == null || !v.militar) continue;
      const cur = acc.get(v.militar_id) ?? {
        militar_id: v.militar_id, nome: v.militar.nome, posto: v.militar.posto ?? null,
        total: 0, semana: 0, fim_semana_feriado: 0,
      };
      const data = v.guarnicao.dia.data;
      const dow = data.getUTCDay();
      const ehFdsFeriado = dow === 0 || dow === 6 || feriadoSet.has(ymd(data));
      cur.total += 1;
      if (ehFdsFeriado) cur.fim_semana_feriado += 1; else cur.semana += 1;
      acc.set(v.militar_id, cur);
    }
    return [...acc.values()].sort((x, y) => x.nome.localeCompare(y.nome));
  },
};
