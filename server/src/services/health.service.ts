import type { HealthResponse } from '@burger/shared';

// Capa de servicios: logica de negocio, sin saber nada de HTTP.
// En Fase 2 este service tambien va a chequear la conexion a Supabase
// a traves de un repository.
export const healthService = {
  getStatus(): HealthResponse {
    return {
      status: 'ok',
      service: 'burger-server',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
