import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('server_started', { port: env.PORT, env: env.NODE_ENV });
});

function shutdown(signal: string) {
  logger.info('server_stopping', { signal });
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
