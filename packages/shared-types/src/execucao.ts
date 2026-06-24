export type SituacaoExecucaoDTO = 'presente' | 'falta' | 'substituido' | 'preenchido';
export type ExecucaoStatusDTO = 'pendente' | 'registrada' | 'validada' | 'rejeitada';

export interface ExecucaoVagaDTO {
  vaga_id: number;
  situacao: SituacaoExecucaoDTO;
  militar_executado_id: number | null;
  do: boolean;
  observacoes: string | null;
}

// Prevista + execução do dia, juntos (para fiscal e gestor).
export interface ExecucaoDiaDTO {
  escala_id: number;
  data: string;                 // YYYY-MM-DD
  execucao_status: ExecucaoStatusDTO;
  validado_em: string | null;
  justificativa: string | null;
  guarnicoes: Array<{
    id: number;
    sigla: string;
    atividade: string;
    turno_inicio: string;
    turno_fim: string;
    ordem: number;
    vagas: Array<{
      id: number;             // vaga prevista
      funcao: string;
      militar_id: number | null;       // previsto
      turno_inicio: string;
      turno_fim: string;
      execucao: ExecucaoVagaDTO | null; // executada (null se ainda não registrada)
    }>;
  }>;
}

export interface ExecucaoPendenteDTO {
  escala_id: number;
  lotacao_id: number;
  data: string;                 // YYYY-MM-DD
  execucao_status: ExecucaoStatusDTO;
  vagas_total: number;
}
