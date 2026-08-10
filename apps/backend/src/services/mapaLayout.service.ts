import type { PrismaClient } from '@prisma/client';
import type { MapaGuarnicaoDoc } from '../integrations/sisbom/types.js';
import { layoutService } from './template.service.js';
import { logger } from '../utils/logger.js';

export interface VagaLayout { funcao: string; quantidade_sugerida: number; patentes_esperadas: number[] }
export interface GuarnicaoLayout {
  sigla: string; atividade: string;
  turno_padrao_inicio: string; turno_padrao_fim: string;
  ordem: number; vagas_sugeridas: VagaLayout[];
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
function normFuncao(f: string | null | undefined): string {
  const s = (f ?? '').trim();
  return (s.length ? s : 'GUARNIÇÃO').slice(0, 60);
}
// moda de um array (empate → primeiro em ordem de inserção → determinístico)
function moda<T>(itens: T[]): T | undefined {
  const cont = new Map<T, number>();
  for (const i of itens) cont.set(i, (cont.get(i) ?? 0) + 1);
  let melhor: T | undefined; let max = -1;
  for (const [k, v] of cont) if (v > max) { max = v; melhor = k; }
  return melhor;
}

// Transforma docs do mapa de força (de UMA lotação) num layout: uma guarnição por
// atividade, turno modal, e uma vaga por função com quantidade = moda da contagem
// daquela função por serviço. Puro e determinístico.
export function agregarLayout(docs: MapaGuarnicaoDoc[]): { guarnicoes: GuarnicaoLayout[] } {
  const porAtividade = new Map<string, MapaGuarnicaoDoc[]>();
  // patentes observadas por função (lotação-wide) → viram patentes_esperadas do layout,
  // que o syncLayoutPatentes persiste como FuncaoPatente(template_id). Aviso soft.
  const patentesPorFuncao = new Map<string, Set<number>>();
  for (const d of docs) {
    const at = (d.atividade ?? '').trim() || '-';
    if (!porAtividade.has(at)) porAtividade.set(at, []);
    porAtividade.get(at)!.push(d);
    for (const m of d.guarnicao ?? []) {
      // _patente vem ora número, ora string ("16") no SISBOM — coage e ignora o inválido.
      const pat = m._patente == null ? NaN : Number(m._patente);
      if (!Number.isInteger(pat)) continue;
      const f = normFuncao(m.str_funcao);
      if (!patentesPorFuncao.has(f)) patentesPorFuncao.set(f, new Set());
      patentesPorFuncao.get(f)!.add(pat);
    }
  }
  const atividades = [...porAtividade.keys()].sort();
  const guarnicoes: GuarnicaoLayout[] = atividades.map((at, ordem) => {
    const grupo = porAtividade.get(at)!;
    const inicios = grupo.map((d) => (d.time_start && HHMM.test(d.time_start) ? d.time_start : '08:00'));
    const fins = grupo.map((d) => (d.time_end && HHMM.test(d.time_end) ? d.time_end : '08:00'));
    // por serviço, conta ocorrências de cada função; depois tira a moda por função
    const contagensPorFuncao = new Map<string, number[]>();
    for (const d of grupo) {
      const contaLocal = new Map<string, number>();
      for (const m of d.guarnicao ?? []) {
        const f = normFuncao(m.str_funcao);
        contaLocal.set(f, (contaLocal.get(f) ?? 0) + 1);
      }
      for (const [f, n] of contaLocal) {
        if (!contagensPorFuncao.has(f)) contagensPorFuncao.set(f, []);
        contagensPorFuncao.get(f)!.push(n);
      }
    }
    const vagas_sugeridas: VagaLayout[] = [...contagensPorFuncao.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([funcao, contagens]) => ({
        funcao,
        quantidade_sugerida: Math.min(50, Math.max(1, moda(contagens) ?? 1)),
        patentes_esperadas: [...(patentesPorFuncao.get(funcao) ?? [])].sort((a, b) => a - b).slice(0, 72),
      }));
    return {
      sigla: at.slice(0, 20),
      atividade: at.slice(0, 40),
      turno_padrao_inicio: moda(inicios) ?? '08:00',
      turno_padrao_fim: moda(fins) ?? '08:00',
      ordem,
      vagas_sugeridas: vagas_sugeridas.length ? vagas_sugeridas : [{ funcao: 'GUARNIÇÃO', quantidade_sugerida: 1, patentes_esperadas: [] }],
    };
  });
  return { guarnicoes };
}

const NOME_LAYOUT = 'Padrão (mapa de força)';

export const mapaLayoutService = {
  // Cria/atualiza o layout "Padrão (mapa de força)" da lotação a partir dos docs.
  // Idempotente: se já existe layout com esse nome, faz replace-all; senão cria.
  async gerarParaLotacao(lotacao_id: number, user_id: number, docs: MapaGuarnicaoDoc[], prisma: PrismaClient) {
    const { guarnicoes } = agregarLayout(docs);
    if (!guarnicoes.length) { logger.info('mapa_layout_skip_sem_docs', { lotacao_id }); return null; }
    const existentes = await layoutService.listarPorLotacao(lotacao_id, prisma);
    const atual = existentes.find((t) => t.nome === NOME_LAYOUT);
    const input = { nome: NOME_LAYOUT, politica_localidade: 'indiferente' as const, guarnicoes };
    if (atual) return layoutService.atualizar(atual.id, user_id, input, prisma);
    return layoutService.criar(lotacao_id, user_id, input, prisma);
  },

  // Roda a geração para todas as lotações operacionais reais com efetivo.
  // `buscarDocs(lotacao)` devolve os docs do mapa de força daquela lotação
  // (o CLI injeta a busca via snapshot; o teste injeta um stub).
  async gerarTodas(user_id: number, buscarDocs: (lotacao: { id: number; sisbom_ref: string }) => Promise<MapaGuarnicaoDoc[]>, prisma: PrismaClient) {
    const lots = await prisma.lotacao.findMany({
      where: { sisbom_ref: { not: null }, operacional: true, user_lotacoes: { some: {} } },
      select: { id: true, sisbom_ref: true },
    });
    let feitas = 0;
    for (const lot of lots) {
      const docs = await buscarDocs({ id: lot.id, sisbom_ref: lot.sisbom_ref! });
      const r = await this.gerarParaLotacao(lot.id, user_id, docs, prisma);
      if (r) feitas++;
    }
    logger.info('mapa_layout_gerar_todas_done', { lotacoes: lots.length, feitas });
    return { lotacoes: lots.length, feitas };
  },
};
