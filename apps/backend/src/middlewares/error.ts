import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { fail } from '../utils/response.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const msg = err.errors[0]?.message ?? 'Dados inválidos.';
    return fail(res, msg, 422);
  }
  logger.error('unhandled_error', { err: err?.message, stack: err?.stack });
  return fail(res, 'Erro interno. Tente novamente.', 500);
};
