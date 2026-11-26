import { Router } from 'express';
import { z } from 'zod';
import { createOrderSchema, quoteRequestSchema } from '@burger/shared';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth';
import { orderLimiter, quoteLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';

export const orderIdParams = z.object({ id: z.uuid() });

export const orderRouter = Router();

// Publico: el invitado ve el resumen del checkout (y prueba cupones) antes de loguearse.
orderRouter.post(
  '/quote',
  quoteLimiter,
  validate({ body: quoteRequestSchema }),
  orderController.quote,
);

// De aca para abajo, todo requiere login.
orderRouter.use(authenticate);

orderRouter.post('/', orderLimiter, validate({ body: createOrderSchema }), orderController.create);
orderRouter.get('/mine', orderController.listMine);
orderRouter.get('/:id', validate({ params: orderIdParams }), orderController.getById);
orderRouter.post('/:id/cancel', validate({ params: orderIdParams }), orderController.cancel);
