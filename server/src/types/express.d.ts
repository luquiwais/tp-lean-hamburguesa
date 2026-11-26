import type { Logger } from '../logger';

// Extiende Request de Express con lo que agregan nuestros middlewares.
declare global {
  namespace Express {
    interface Request {
      traceId: string;
      log: Logger;
      // Datos ya validados por el middleware validate()
      valid: {
        params?: unknown;
        query?: unknown;
        body?: unknown;
      };
    }
  }
}

export {};
