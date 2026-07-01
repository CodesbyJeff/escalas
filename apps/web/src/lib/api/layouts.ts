import type { LayoutResumoDTO, TemplateLotacaoDTO } from '@escalas/shared-types';
import type { CriarLayoutInput } from '@escalas/shared-schemas';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const layoutsApi = {
  listar: (lotacaoId: number) => apiGet<LayoutResumoDTO[]>(`/templates/lotacao/${lotacaoId}`),
  obter: (id: number) => apiGet<TemplateLotacaoDTO>(`/templates/${id}`),
  criar: (lotacaoId: number, input: CriarLayoutInput) => apiPost<TemplateLotacaoDTO>(`/templates/lotacao/${lotacaoId}`, input),
  atualizar: (id: number, input: CriarLayoutInput) => apiPut<TemplateLotacaoDTO>(`/templates/${id}`, input),
  excluir: (id: number) => apiDelete<null>(`/templates/${id}`),
};
