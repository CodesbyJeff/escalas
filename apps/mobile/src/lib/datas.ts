// apps/mobile/src/lib/datas.ts
import type { MeuServicoDTO } from '@escalas/shared-types';

export function proximoServico(servicos: MeuServicoDTO[], hojeYMD: string): MeuServicoDTO | null {
  return servicos.filter((s) => s.data >= hojeYMD).sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;
}

function addDiasYMD(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function proximos7Dias(servicos: MeuServicoDTO[], hojeYMD: string): MeuServicoDTO[] {
  const fim = addDiasYMD(hojeYMD, 6);
  return servicos.filter((s) => s.data >= hojeYMD && s.data <= fim).sort((a, b) => (a.data === b.data ? a.turno_inicio.localeCompare(b.turno_inicio) : a.data.localeCompare(b.data)));
}

export function agruparPorDia(servicos: MeuServicoDTO[]): Record<string, MeuServicoDTO[]> {
  const out: Record<string, MeuServicoDTO[]> = {};
  for (const s of servicos) (out[s.data] ??= []).push(s);
  return out;
}

export function markedDates(servicos: MeuServicoDTO[]): Record<string, { marked: true }> {
  const out: Record<string, { marked: true }> = {};
  for (const s of servicos) out[s.data] = { marked: true };
  return out;
}
