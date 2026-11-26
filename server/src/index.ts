import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { startAutoAdvance } from './services/autoAdvance.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('server_started', { port: env.PORT, env: env.NODE_ENV });
});

// Job de la demo: solo actua si el admin activa "auto-avance" en la configuracion.
const stopAutoAdvance = env.NODE_ENV === 'test' ? () => {} : startAutoAdvance(logger);

function shutdown(signal: string) {
  logger.info('server_stopping', { signal });
  stopAutoAdvance();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
