import { apiGet } from './client';

export interface LotacaoResumo {
  id: number;
  sigla: string;
  nome: string;
}

export const lotacoesApi = {
  listar: () => apiGet<LotacaoResumo[]>('/admin/lotacoes'),
};
