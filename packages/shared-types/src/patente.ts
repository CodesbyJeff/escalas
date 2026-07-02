export interface PatenteDTO {
  id: number;
  forca_id: number;
  sigla: string;
  nome: string;
  ordem: number;
}

export interface FuncaoPatenteDTO {
  id: number;
  lotacao_id: number | null;
  template_id: number | null;
  funcao_norm: string;
  patente_ids: number[];
}
