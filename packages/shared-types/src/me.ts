export interface MeuServicoDTO {
  vaga_id: number;
  data: string; // YYYY-MM-DD
  funcao: string;
  turno_inicio: string;
  turno_fim: string;
  guarnicao: { sigla: string; atividade: string; turno_inicio: string; turno_fim: string };
  lotacao: { id: number; sigla: string; nome: string };
}
