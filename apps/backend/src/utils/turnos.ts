export function parseHHmm(s: string): number {
  const parts = s.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Formato HH:mm inválido: "${s}"`);
  }
  return h * 60 + m;
}

// Normaliza turno noturno (fim <= inicio) somando 24h ao fim.
function intervalo(inicio: string, fim: string): [number, number] {
  const ini = parseHHmm(inicio);
  let f = parseHHmm(fim);
  if (f <= ini) f += 1440;
  return [ini, f];
}

function overlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1;
}

export function turnosSobrepoem(
  aInicio: string,
  aFim: string,
  bInicio: string,
  bFim: string,
): boolean {
  const [as, ae] = intervalo(aInicio, aFim);
  const [bs, be] = intervalo(bInicio, bFim);
  // Compara nas bases 0–48h: cobre casos onde um turno noturno cruza a meia-noite
  // e o outro cai na manhã (deslocado +24h) ou na noite (base).
  return (
    overlap(as, ae, bs, be) ||
    overlap(as, ae, bs + 1440, be + 1440) ||
    overlap(as + 1440, ae + 1440, bs, be)
  );
}

export interface VagaTurno {
  id: number;
  militar_id: number | null;
  turno_inicio: string;
  turno_fim: string;
}

export interface ConflitoTurno {
  militar_id: number;
  vaga_ids: number[];
}

export function encontrarConflitos(vagas: VagaTurno[]): ConflitoTurno[] {
  const porMilitar = new Map<number, VagaTurno[]>();
  for (const v of vagas) {
    if (v.militar_id == null) continue;
    const arr = porMilitar.get(v.militar_id) ?? [];
    arr.push(v);
    porMilitar.set(v.militar_id, arr);
  }

  const conflitos: ConflitoTurno[] = [];
  for (const [militar_id, lista] of porMilitar) {
    const emConflito = new Set<number>();
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]!;
        const b = lista[j]!;
        if (turnosSobrepoem(a.turno_inicio, a.turno_fim, b.turno_inicio, b.turno_fim)) {
          emConflito.add(a.id);
          emConflito.add(b.id);
        }
      }
    }
    if (emConflito.size > 0) {
      conflitos.push({ militar_id, vaga_ids: [...emConflito].sort((x, y) => x - y) });
    }
  }
  return conflitos;
}
