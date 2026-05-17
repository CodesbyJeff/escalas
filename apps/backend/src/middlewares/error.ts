import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { fail } from '../utils/response.js';
import { HttpError } from '../utils/errors.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const msg = err.errors[0]?.message ?? 'Dados inválidos.';
    return fail(res, msg, 422);
  }
  if (err instanceof TokenExpiredError) {
    return fail(res, 'Token expirado.', 401);
  }
  if (err instanceof JsonWebTokenError) {
    return fail(res, 'Token inválido.', 401);
  }
  if (err instanceof HttpError) {
    return fail(res, err.message, err.status);
  }
  logger.error('unhandled_error', { err: err?.message, stack: err?.stack });
  return fail(res, 'Erro interno. Tente novamente.', 500);
};
