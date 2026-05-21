export type EscalaStatusDTO = 'rascunho' | 'publicada' | 'em_validacao' | 'aprovada' | 'rejeitada';

export interface VagaDTO {
  id: number;
  funcao: string;
  militar_id: number | null;
  turno_inicio: string;
  turno_fim: string;
  observacoes: string | null;
}

export interface EscalaGuarnicaoDTO {
  id: number;
  sigla: string;
  atividade: string;
  viatura_id: string | null;
  turno_inicio: string;
  turno_fim: string;
  ordem: number;
  vagas: VagaDTO[];
}

export interface EscalaDiaDTO {
  id: number;
  data: string;
  observacoes: string | null;
  guarnicoes: EscalaGuarnicaoDTO[];
}

export interface EscalaDTO {
  id: number;
  lotacao_id: number;
  mes: number;
  ano: number;
  status: EscalaStatusDTO;
  criado_por_id: number;
  publicado_em: string | null;
}

export interface ConflitoTurno {
  militar_id: number;
  vaga_ids: number[];
}
