import type { Request, RequestHandler } from 'express';
import type {
  AdminOrdersQuery,
  CategoryInput,
  CategoryUpdate,
  ModifierGroupInput,
  ModifierGroupUpdate,
  ModifierInput,
  ModifierUpdate,
  ProductInput,
  ProductUpdate,
  SettingsUpdate,
} from '@burger/shared';
import { badRequest } from '../lib/errors';
import { adminCatalogService as catalog } from '../services/adminCatalog.service';
import { dashboardService } from '../services/dashboard.service';
import { orderService } from '../services/order.service';

const id = (req: Request) => (req.valid.params as { id: string }).id;
const body = <T>(req: Request) => req.valid.body as T;

// Respuestas del admin: datos internos, nunca cachear.
const send: (fn: (req: Request) => Promise<unknown>, status?: number) => RequestHandler =
  (fn, status = 200) =>
  async (req, res) => {
    const data = await fn(req);
    res.set('Cache-Control', 'no-store').status(status).json(data);
  };

export const adminController = {
  dashboard: send(() => dashboardService.get()),
  listOrders: send((req) => orderService.listAdmin(req.valid.query as AdminOrdersQuery)),

  getSettings: send(() => catalog.getSettings()),
  updateSettings: send((req) => catalog.updateSettings(body<SettingsUpdate>(req))),

  listCategories: send(() => catalog.listCategories()),
  createCategory: send((req) => catalog.createCategory(body<CategoryInput>(req)), 201),
  updateCategory: send((req) => catalog.updateCategory(id(req), body<CategoryUpdate>(req))),

  listProducts: send(() => catalog.listProducts()),
  createProduct: send((req) => catalog.createProduct(body<ProductInput>(req)), 201),
  updateProduct: send((req) => catalog.updateProduct(id(req), body<ProductUpdate>(req))),
  deleteProduct: (async (req, res) => {
    await catalog.deactivateProduct(id(req));
    res.status(204).end();
  }) satisfies RequestHandler,
  uploadProductImage: send((req) => {
    if (!req.file) throw badRequest('Falta el archivo (campo "image")');
    return catalog.uploadProductImage(id(req), req.file.buffer, req.log);
  }),

  listGroups: send(() => catalog.listGroups()),
  createGroup: send((req) => catalog.createGroup(body<ModifierGroupInput>(req)), 201),
  updateGroup: send((req) => catalog.updateGroup(id(req), body<ModifierGroupUpdate>(req))),
  createModifier: send((req) => catalog.createModifier(id(req), body<ModifierInput>(req)), 201),
  updateModifier: send((req) => catalog.updateModifier(id(req), body<ModifierUpdate>(req))),
};
