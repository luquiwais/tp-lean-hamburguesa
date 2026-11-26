import { Router } from 'express';
import { healthRouter } from './health.routes';
import { menuRouter, productsRouter } from './catalog.routes';
import { authRouter } from './auth.routes';
import { adminRouter } from './admin';

// Router raiz montado en /api. Proximas fases: /orders, /coupons, mas /admin/*.
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
