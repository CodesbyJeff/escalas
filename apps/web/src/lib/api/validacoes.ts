import type { EscalaDTO, ResumoServicoDTO, ValidacaoEscalaDTO } from '@escalas/shared-types';
import type { ValidarEscalaInput } from '@escalas/shared-schemas';
import { apiGet, apiPost } from './client';

export const validacoesApi = {
  pendentes: () => apiGet<EscalaDTO[]>('/validacoes/pendentes'),
  resumoServicos: (id: number) => apiGet<ResumoServicoDTO[]>(`/escalas/${id}/resumo-servicos`),
  validar: (id: number, input: ValidarEscalaInput) => apiPost<ValidacaoEscalaDTO>(`/escalas/${id}/validar`, input),
  validacoes: (id: number) => apiGet<ValidacaoEscalaDTO[]>(`/escalas/${id}/validacoes`),
};
