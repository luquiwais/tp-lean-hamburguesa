import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from '../logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Asigna un trace_id a cada request (reusa el header x-trace-id si viene
// y es un UUID valido; si no, genera uno). Lo devuelve en la respuesta y
// adjunta un logger hijo para que todos los logs del request lo incluyan.
export const traceId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-trace-id');
  const id = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();

  req.traceId = id;
  req.log = logger.child({ trace_id: id });
  res.setHeader('x-trace-id', id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ip: req.ip,
      duration_ms: Math.round(durationMs),
    });
  });

  next();
};
