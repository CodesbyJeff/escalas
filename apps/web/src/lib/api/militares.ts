import type { MilitarDTO } from '@escalas/shared-types';
import { apiGet } from './client';

export const militaresApi = {
  listar: (escalaId: number, busca?: string) =>
    apiGet<MilitarDTO[]>(`/escalas/${escalaId}/militares${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
};
