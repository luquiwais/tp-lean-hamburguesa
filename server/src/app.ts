import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { traceId } from './middlewares/traceId';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { apiRouter } from './routes';

// Arma la app de Express separada de index.ts para poder testearla con
// Supertest sin levantar el puerto.
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // IP real del cliente detras de Vercel/Render

  app.use(traceId);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true, // necesario para la cookie httpOnly del refresh token
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
