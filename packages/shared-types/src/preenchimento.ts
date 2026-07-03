export interface PreenchimentoSugestaoDTO {
  vaga_id: number;
  data: string; // YYYY-MM-DD
  guarnicao_sigla: string;
  funcao: string;
  militar_id: number | null;
  militar_nome: string | null;
  motivo: string;
  aviso_patente: boolean;
  aviso_descanso: boolean;
}
