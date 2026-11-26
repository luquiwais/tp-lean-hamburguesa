import type { RequestHandler } from 'express';
import { healthService } from '../services/health.service';

// Capa de controllers: traduce HTTP <-> service. No contiene logica de negocio.
// Express 5 propaga solo los errores de handlers async al errorHandler.
export const healthController = {
  get: (async (req, res) => {
    const status = await healthService.getStatus(req.log);
    res.status(status.database === 'ok' ? 200 : 503).json(status);
  }) satisfies RequestHandler,
};
