export interface AvisoPatenteDTO {
  data: string; // YYYY-MM-DD
  guarnicao_sigla: string;
  funcao: string;
  militar_id: number;
  militar_nome: string;
  patente_sigla: string | null;
  patentes_esperadas: number[];
}
