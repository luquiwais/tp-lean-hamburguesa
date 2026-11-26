import type { RequestHandler } from 'express';
import { healthService } from '../services/health.service';

// Capa de controllers: traduce HTTP <-> service. No contiene logica de negocio.
export const healthController = {
  get: ((_req, res) => {
    res.json(healthService.getStatus());
  }) satisfies RequestHandler,
};
