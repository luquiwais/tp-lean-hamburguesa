import { Router } from 'express';
import { healthRouter } from './health.routes';
import { menuRouter, productsRouter } from './catalog.routes';

// Router raiz montado en /api. Cada dominio suma su router aca:
// /auth, /orders, /coupons, /admin/* (proximas fases)
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/products', productsRouter);
