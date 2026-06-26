export type ValidacaoStatusDTO = 'aprovada' | 'rejeitada';

export interface ValidacaoEscalaDTO {
  id: number;
  escala_versao_id: number;
  gestor_id: number;
  status: ValidacaoStatusDTO;
  justificativa: string | null;
  created_at: string;
}

export interface MapaForcaDTO {
  militares: Record<string, unknown>[];
  resumo: Record<string, unknown> | null;
}

export interface ResumoServicoDTO {
  militar_id: number;
  nome: string;
  posto: string | null;
  total: number;
  semana: number;
  fim_semana_feriado: number;
}
