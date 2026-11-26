import { Router } from 'express';
import { healthRouter } from './health.routes';
import { menuRouter, productsRouter } from './catalog.routes';
import { authRouter } from './auth.routes';
import { adminRouter } from './admin';
import { orderRouter } from './order.routes';

// Router raiz montado en /api. Proxima fase: mas /admin/* (productos, pedidos, dashboard).
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/admin', adminRouter);
