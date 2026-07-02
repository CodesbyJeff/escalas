import type { PatenteDTO } from '@escalas/shared-types';
import { apiGet } from './client';

export const patentesApi = {
  listar: () => apiGet<PatenteDTO[]>('/patentes'),
};
