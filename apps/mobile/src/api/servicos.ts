import type { MeuServicoDTO } from '@escalas/shared-types';
import { apiGet } from './client';
export const servicosApi = {
  meus: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return apiGet<MeuServicoDTO[]>(`/me/servicos${qs ? `?${qs}` : ''}`);
  },
};
