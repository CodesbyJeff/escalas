import type { ExecucaoDiaDTO, ExecucaoPendenteDTO } from '@escalas/shared-types';
import type { PutExecucaoInput, ValidarExecucaoInput } from '@escalas/shared-schemas';
import { apiGet, apiPost, apiPut } from './client';

export const execucaoApi = {
  pendentesFiscal: () => apiGet<ExecucaoPendenteDTO[]>('/execucoes/pendentes/fiscal'),
  pendentesGestor: () => apiGet<ExecucaoPendenteDTO[]>('/execucoes/pendentes/gestor'),
  getDia: (id: number, data: string) => apiGet<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}`),
  salvar: (id: number, data: string, input: PutExecucaoInput) =>
    apiPut<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}`, input),
  fechar: (id: number, data: string) =>
    apiPost<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}/fechar`),
  validar: (id: number, data: string, input: ValidarExecucaoInput) =>
    apiPost<ExecucaoDiaDTO>(`/escalas/${id}/execucao/${data}/validar`, input),
};
