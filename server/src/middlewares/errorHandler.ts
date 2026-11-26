import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, notFound } from '../lib/errors';

// 404 para cualquier ruta /api que no matcheo.
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound('Ruta no encontrada'));
};

// Manejador central de errores. Los AppError se devuelven con su mensaje;
// cualquier otro error se loguea completo internamente y al cliente solo
// le llega un mensaje generico con el trace_id para poder rastrearlo.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) req.log.error('app_error', { err });
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
      traceId: req.traceId,
    });
    return;
  }

  // Subida de archivos (multer): tamanio, cantidad de archivos, campos raros
  if (err?.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 2 MB' : 'Archivo invalido';
    res.status(400).json({ error: { code: 'BAD_REQUEST', message }, traceId: req.traceId });
    return;
  }

  // JSON mal formado en el body
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'JSON invalido' },
      traceId: req.traceId,
    });
    return;
  }

  req.log.error('unhandled_error', { err });
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Ocurrio un error inesperado' },
    traceId: req.traceId,
  });
};
