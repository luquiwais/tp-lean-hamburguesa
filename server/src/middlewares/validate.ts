import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors';

interface Schemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

// Valida params, query y body contra schemas Zod ANTES de llegar al
// controller. Todo input del usuario se considera malicioso: si no pasa,
// 400 con el detalle de los campos (sin datos internos).
// Los valores parseados quedan en req.valid.{params,query,body}.
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const valid: Record<string, unknown> = {};
    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(badRequest('Datos invalidos', z.flattenError(result.error).fieldErrors));
      }
      valid[key] = result.data;
    }
    req.valid = valid;
    next();
  };
}
