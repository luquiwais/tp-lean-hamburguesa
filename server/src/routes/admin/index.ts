import { Router } from 'express';
import { z } from 'zod';
import {
  adminOrdersQuerySchema,
  categoryInputSchema,
  categoryUpdateSchema,
  changeStatusSchema,
  modifierGroupInputSchema,
  modifierGroupUpdateSchema,
  modifierInputSchema,
  modifierUpdateSchema,
  productInputSchema,
  productUpdateSchema,
  settingsUpdateSchema,
} from '@burger/shared';
import { adminController as c } from '../../controllers/admin.controller';
import { orderController } from '../../controllers/order.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { imageUpload } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';

// Todo /api/admin/* exige un usuario logueado con rol admin.
export const adminRouter = Router();
adminRouter.use(authenticate, authorize('admin'));

const byId = { params: z.object({ id: z.uuid() }) };

adminRouter.get('/ping', (req, res) => {
  res.json({ ok: true, userId: req.user!.id });
});

// Dashboard
adminRouter.get('/dashboard', c.dashboard);

// Pedidos
adminRouter.get('/orders', validate({ query: adminOrdersQuerySchema }), c.listOrders);
adminRouter.get('/orders/:id', validate(byId), orderController.getById);
adminRouter.patch(
  '/orders/:id/status',
  validate({ ...byId, body: changeStatusSchema }),
  orderController.changeStatus,
);

// Configuracion del local
adminRouter.get('/settings', c.getSettings);
adminRouter.patch('/settings', validate({ body: settingsUpdateSchema }), c.updateSettings);

// Categorias
adminRouter.get('/categories', c.listCategories);
adminRouter.post('/categories', validate({ body: categoryInputSchema }), c.createCategory);
adminRouter.patch(
  '/categories/:id',
  validate({ ...byId, body: categoryUpdateSchema }),
  c.updateCategory,
);

// Productos
adminRouter.get('/products', c.listProducts);
adminRouter.post('/products', validate({ body: productInputSchema }), c.createProduct);
adminRouter.patch(
  '/products/:id',
  validate({ ...byId, body: productUpdateSchema }),
  c.updateProduct,
);
adminRouter.delete('/products/:id', validate(byId), c.deleteProduct);
adminRouter.post('/products/:id/image', validate(byId), imageUpload, c.uploadProductImage);

// Grupos de modificadores y sus opciones
adminRouter.get('/modifier-groups', c.listGroups);
adminRouter.post('/modifier-groups', validate({ body: modifierGroupInputSchema }), c.createGroup);
adminRouter.patch(
  '/modifier-groups/:id',
  validate({ ...byId, body: modifierGroupUpdateSchema }),
  c.updateGroup,
);
adminRouter.post(
  '/modifier-groups/:id/modifiers',
  validate({ ...byId, body: modifierInputSchema }),
  c.createModifier,
);
adminRouter.patch(
  '/modifiers/:id',
  validate({ ...byId, body: modifierUpdateSchema }),
  c.updateModifier,
);
