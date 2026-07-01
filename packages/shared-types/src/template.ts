export interface TemplateVagaSugeridaDTO {
  id: number;
  funcao: string;
  quantidade_sugerida: number;
}

export interface TemplateGuarnicaoDTO {
  id: number;
  sigla: string;
  atividade: string;
  turno_padrao_inicio: string;
  turno_padrao_fim: string;
  ordem: number;
  vagas_sugeridas: TemplateVagaSugeridaDTO[];
}

export interface TemplateLotacaoDTO {
  id: number;
  lotacao_id: number;
  nome: string;
  criado_por_id: number;
  updated_at: string;
  guarnicoes: TemplateGuarnicaoDTO[];
}

export interface LayoutResumoDTO {
  id: number;
  lotacao_id: number;
  nome: string;
  qtd_guarnicoes: number;
}
