import type { FuncaoPatenteDTO } from '@escalas/shared-types';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const funcaoPatentesApi = {
  listar: (lotacaoId?: number) =>
    apiGet<FuncaoPatenteDTO[]>(`/funcao-patentes${lotacaoId ? `?lotacao_id=${lotacaoId}` : ''}`),
  criar: (body: { lotacao_id: number | null; funcao: string; patente_ids: number[] }) =>
    apiPost<FuncaoPatenteDTO>('/funcao-patentes', body),
  atualizar: (id: number, body: { patente_ids: number[] }) =>
    apiPut<FuncaoPatenteDTO>(`/funcao-patentes/${id}`, body),
  excluir: (id: number) => apiDelete<null>(`/funcao-patentes/${id}`),
};
