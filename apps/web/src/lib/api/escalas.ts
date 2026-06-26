import type { EscalaDTO, EscalaDiaDTO, EscalaMesDTO } from '@escalas/shared-types';
import type { CriarEscalaInput, PutDiaInput } from '@escalas/shared-schemas';
import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const escalasApi = {
  listar: () => apiGet<EscalaDTO[]>('/escalas'),
  criar: (input: CriarEscalaInput) => apiPost<EscalaDTO>('/escalas', input),
  detalhe: (id: number) => apiGet<EscalaDTO>(`/escalas/${id}`),
  getDia: (id: number, data: string) => apiGet<EscalaDiaDTO>(`/escalas/${id}/dias/${data}`),
  putDia: (id: number, data: string, input: PutDiaInput) => apiPut<EscalaDiaDTO>(`/escalas/${id}/dias/${data}`, input),
  duplicarDia: (id: number, data: string, de: string) => apiPost<EscalaDiaDTO>(`/escalas/${id}/dias/${data}/duplicar`, { de }),
  publicar: (id: number) => apiPost<EscalaDTO>(`/escalas/${id}/publicar`),
  getMes: (id: number) => apiGet<EscalaMesDTO>(`/escalas/${id}/mes`),
  deletar: (id: number) => apiDelete<null>(`/escalas/${id}`),
};
