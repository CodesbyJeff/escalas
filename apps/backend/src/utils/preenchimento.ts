import { parseHHmm } from './turnos.js';

export interface MilitarPool { id: number; nome: string; patente_id: number | null }
export interface VagaAberta { vaga_id: number; data: string; guarnicao_sigla: string; guarnicao_ordem: number; funcao: string; turno_inicio: string; turno_fim: string }
export interface IntervaloExistente { militar_id: number; data: string; turno_inicio: string; turno_fim: string }
export interface PlanoInput {
  descanso_horas: number;
  militares: MilitarPool[];
  contagemInicial: Map<number, number>;
  intervalosExistentes: IntervaloExistente[];
  vagas: VagaAberta[];
  esperadasPorFuncao: Map<string, number[]>; // funcao (como vem na vaga) → patentes esperadas ([] = sem regra)
}
export interface ResultadoVaga {
  vaga_id: number; data: string; guarnicao_sigla: string; funcao: string;
  militar_id: number | null; militar_nome: string | null;
  motivo: string; aviso_patente: boolean; aviso_descanso: boolean;
}

// dias desde a época UTC → minutos absolutos; convenção 24h (fim ≤ início ⇒ dia seguinte).
function intervaloAbs(data: string, inicio: string, fim: string): [number, number] {
  const diaMin = Math.floor(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)) / 60000);
  const ini = diaMin + parseHHmm(inicio);
  let f = diaMin + parseHHmm(fim);
  if (parseHHmm(fim) <= parseHHmm(inicio)) f += 1440;
  return [ini, f];
}
const overlap = (s1: number, e1: number, s2: number, e2: number) => s1 < e2 && s2 < e1;

export function planejarPreenchimento(input: PlanoInput): ResultadoVaga[] {
  const { descanso_horas } = input;
  const descMin = descanso_horas * 60;
  const contagem = new Map(input.contagemInicial);
  // intervalos por militar (pré-existentes + atribuídos na rodada)
  const porMilitar = new Map<number, [number, number][]>();
  for (const m of input.militares) porMilitar.set(m.id, []);
  for (const ie of input.intervalosExistentes) {
    if (!porMilitar.has(ie.militar_id)) porMilitar.set(ie.militar_id, []);
    porMilitar.get(ie.militar_id)!.push(intervaloAbs(ie.data, ie.turno_inicio, ie.turno_fim));
  }
  const nomeDe = new Map(input.militares.map((m) => [m.id, m.nome] as const));
  const patenteDe = new Map(input.militares.map((m) => [m.id, m.patente_id] as const));

  const vagasOrdenadas = [...input.vagas].sort((a, b) =>
    a.data.localeCompare(b.data) || a.guarnicao_ordem - b.guarnicao_ordem || a.vaga_id - b.vaga_id);

  const out: ResultadoVaga[] = [];
  for (const v of vagasOrdenadas) {
    const [vs, ve] = intervaloAbs(v.data, v.turno_inicio, v.turno_fim);
    const esperadas = input.esperadasPorFuncao.get(v.funcao) ?? [];
    type Cand = { id: number; conflito: boolean; violaDescanso: boolean; patenteOk: boolean; contagem: number };
    const cands: Cand[] = input.militares.map((m) => {
      const ints = porMilitar.get(m.id) ?? [];
      const conflito = ints.some(([s, e]) => overlap(vs, ve, s, e));
      const violaDescanso = ints.some(([s, e]) => !overlap(vs, ve, s, e) && (
        (e <= vs && vs - e < descMin) || (ve <= s && s - ve < descMin)));
      const pid = patenteDe.get(m.id) ?? null;
      const patenteOk = esperadas.length === 0 || (pid != null && esperadas.includes(pid));
      return { id: m.id, conflito, violaDescanso, patenteOk, contagem: contagem.get(m.id) ?? 0 };
    }).filter((c) => !c.conflito);

    if (cands.length === 0) {
      out.push({ vaga_id: v.vaga_id, data: v.data, guarnicao_sigla: v.guarnicao_sigla, funcao: v.funcao, militar_id: null, militar_nome: null, motivo: 'sem candidato sem conflito de turno', aviso_patente: false, aviso_descanso: false });
      continue;
    }
    cands.sort((a, b) =>
      Number(a.violaDescanso) - Number(b.violaDescanso) ||
      Number(b.patenteOk) - Number(a.patenteOk) ||
      a.contagem - b.contagem ||
      a.id - b.id);
    const esc = cands[0]!;
    porMilitar.get(esc.id)!.push([vs, ve]);
    contagem.set(esc.id, (contagem.get(esc.id) ?? 0) + 1);
    const partes = [`menos serviços (${esc.contagem})`, esc.violaDescanso ? 'sem descanso pleno' : 'descansado', esc.patenteOk ? 'patente ok' : 'patente divergente'];
    out.push({
      vaga_id: v.vaga_id, data: v.data, guarnicao_sigla: v.guarnicao_sigla, funcao: v.funcao,
      militar_id: esc.id, militar_nome: nomeDe.get(esc.id) ?? null,
      motivo: partes.join(' · '), aviso_patente: !esc.patenteOk, aviso_descanso: esc.violaDescanso,
    });
  }
  return out;
}
