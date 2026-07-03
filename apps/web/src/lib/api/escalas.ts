import type { EscalaDTO, EscalaDiaDTO, EscalaMesDTO, PreenchimentoSugestaoDTO } from '@escalas/shared-types';
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
  gerarBloco: (id: number, body: { data_ini: string; data_fim: string; template_id: number }) =>
    apiPost<{ dias_afetados: number }>(`/escalas/${id}/gerar-bloco`, body),
  repetirCiclo: (id: number, body: { ciclo_ini: string; ciclo_fim: string; ate: string }) =>
    apiPost<{ dias_afetados: number }>(`/escalas/${id}/repetir-ciclo`, body),
  sugerirPreenchimento: (id: number, body: { data_ini: string; data_fim: string; descanso_horas?: number }) =>
    apiPost<PreenchimentoSugestaoDTO[]>(`/escalas/${id}/sugerir-preenchimento`, body),
  aplicarPreenchimento: (id: number, body: { data_ini: string; data_fim: string; descanso_horas?: number }) =>
    apiPost<{ vagas_preenchidas: number; avisos_patente: number; avisos_descanso: number }>(
      `/escalas/${id}/aplicar-preenchimento`, body,
    ),
};
