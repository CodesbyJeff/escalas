import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { fail } from '../utils/response.js';

export function validate<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.errors[0]?.message ?? 'Dados inválidos';
      return fail(res, msg, 422);
    }
    req.body = result.data;
    next();
  };
}
