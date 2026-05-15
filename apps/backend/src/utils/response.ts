import type { Response } from 'express';
import type { ApiSuccess, ApiFailure } from '@escalas/shared-types';

export function ok<T>(res: Response, message: string, data: T, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, message, data };
  return res.status(status).json(body);
}

export function fail(res: Response, message: string, status = 400): Response {
  const body: ApiFailure = { success: false, message, data: null };
  return res.status(status).json(body);
}
