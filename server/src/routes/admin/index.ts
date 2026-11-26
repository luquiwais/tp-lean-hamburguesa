import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';

// Todo /api/admin/* exige un usuario logueado con rol admin.
// Los routers de productos, pedidos y dashboard se suman en la Fase 6.
export const adminRouter = Router();

adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/ping', (req, res) => {
  res.json({ ok: true, userId: req.user!.id });
});
