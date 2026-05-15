import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';
import { fail } from '../utils/response.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error('unhandled_error', { err: err?.message, stack: err?.stack });
  return fail(res, 'Erro interno. Tente novamente.', 500);
};
