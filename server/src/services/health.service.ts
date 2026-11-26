import type { HealthResponse } from '@burger/shared';
import { healthRepository } from '../repositories/health.repository';
import type { Logger } from '../logger';

// Capa de servicios: logica de negocio, sin saber nada de HTTP.
// Si la DB no responde, el server sigue "vivo" pero reporta database: 'error'.
export const healthService = {
  async getStatus(log: Logger): Promise<HealthResponse> {
    let database: HealthResponse['database'] = 'ok';
    try {
      await healthRepository.pingDatabase();
    } catch (err) {
      database = 'error';
      log.error('health_db_check_failed', { err });
    }

    return {
      status: 'ok',
      service: 'burger-server',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
};
