interface TplGuarnicao {
  sigla: string; atividade: string; turno_padrao_inicio: string; turno_padrao_fim: string;
  ordem: number; vagas_sugeridas: { funcao: string; quantidade_sugerida: number }[];
}

// Guarnições (com vagas ABERTAS) a criar num EscalaDia a partir de um layout.
export function guarnicoesCreateDoTemplate(guarnicoes: TplGuarnicao[]) {
  return guarnicoes.map((g) => ({
    sigla: g.sigla, atividade: g.atividade,
    turno_inicio: g.turno_padrao_inicio, turno_fim: g.turno_padrao_fim, ordem: g.ordem,
    vagas: {
      create: g.vagas_sugeridas.flatMap((vs) =>
        Array.from({ length: vs.quantidade_sugerida }, () => ({
          funcao: vs.funcao, turno_inicio: g.turno_padrao_inicio, turno_fim: g.turno_padrao_fim,
        })),
      ),
    },
  }));
}

// Datas UTC de iniStr..fimStr (YYYY-MM-DD), inclusive.
export function diasNoIntervalo(iniStr: string, fimStr: string): Date[] {
  const ini = new Date(`${iniStr}T00:00:00.000Z`);
  const fim = new Date(`${fimStr}T00:00:00.000Z`);
  const out: Date[] = [];
  for (let d = new Date(ini); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) out.push(new Date(d));
  return out;
}
