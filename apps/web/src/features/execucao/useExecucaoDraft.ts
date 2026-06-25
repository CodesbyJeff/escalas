// apps/web/src/features/execucao/useExecucaoDraft.ts
import { useState } from 'react';
import type { ExecucaoDiaDTO, SituacaoExecucaoDTO } from '@escalas/shared-types';
import type { PutExecucaoInput } from '@escalas/shared-schemas';

export interface ExecucaoVagaDraft {
  vaga_id: number;
  situacao: SituacaoExecucaoDTO;
  militar_executado_id: number | null;
  do: boolean;
  observacoes: string;
}

function seed(dia: ExecucaoDiaDTO): Record<number, ExecucaoVagaDraft> {
  const m: Record<number, ExecucaoVagaDraft> = {};
  for (const g of dia.guarnicoes) {
    for (const v of g.vagas) {
      m[v.id] = v.execucao
        ? {
            vaga_id: v.id, situacao: v.execucao.situacao,
            militar_executado_id: v.execucao.militar_executado_id,
            do: v.execucao.do, observacoes: v.execucao.observacoes ?? '',
          }
        : { vaga_id: v.id, situacao: 'presente', militar_executado_id: null, do: false, observacoes: '' };
    }
  }
  return m;
}

export function useExecucaoDraft(dia: ExecucaoDiaDTO) {
  const [vagas, setVagas] = useState<Record<number, ExecucaoVagaDraft>>(() => seed(dia));

  const setVaga = (vaga_id: number, patch: Partial<ExecucaoVagaDraft>) =>
    setVagas((prev) => {
      const atual = prev[vaga_id];
      if (!atual) return prev;
      const next = { ...atual, ...patch };
      // presente/falta não têm substituto
      if (next.situacao === 'presente' || next.situacao === 'falta') next.militar_executado_id = null;
      return { ...prev, [vaga_id]: next };
    });

  const toPutInput = (): PutExecucaoInput => ({
    vagas: Object.values(vagas).map((v) => ({
      vaga_id: v.vaga_id,
      situacao: v.situacao,
      militar_executado_id: v.militar_executado_id,
      do: v.do,
      observacoes: v.observacoes.trim() ? v.observacoes.trim() : undefined,
    })),
  });

  return { vagas, getVaga: (id: number) => vagas[id], setVaga, toPutInput };
}
