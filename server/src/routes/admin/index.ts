import { Router } from 'express';
import { changeStatusSchema } from '@burger/shared';
import { orderController } from '../../controllers/order.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { orderIdParams } from '../order.routes';

// Todo /api/admin/* exige un usuario logueado con rol admin.
// Productos, listado de pedidos y dashboard se suman en la Fase 6.
export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/ping', (req, res) => {
  res.json({ ok: true, userId: req.user!.id });
});

adminRouter.get('/orders/:id', validate({ params: orderIdParams }), orderController.getById);
adminRouter.patch(
  '/orders/:id/status',
  validate({ params: orderIdParams, body: changeStatusSchema }),
  orderController.changeStatus,
);
