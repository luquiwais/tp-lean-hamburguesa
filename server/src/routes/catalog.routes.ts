import { Router } from 'express';
import { z } from 'zod';
import { slugSchema } from '@burger/shared';
import { validate } from '../middlewares/validate';
import { catalogController } from '../controllers/catalog.controller';

// Rutas publicas del catalogo (no requieren login).
export const menuRouter = Router();
menuRouter.get('/', catalogController.getMenu);

export const productsRouter = Router();
productsRouter.get(
  '/:slug',
  validate({ params: z.object({ slug: slugSchema }) }),
  catalogController.getProduct,
);
