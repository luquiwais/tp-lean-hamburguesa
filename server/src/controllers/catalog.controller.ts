import type { RequestHandler } from 'express';
import { catalogService } from '../services/catalog.service';

// Catalogo publico: se puede cachear un rato en el navegador/CDN.
const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=60';

export const catalogController = {
  getMenu: (async (_req, res) => {
    const menu = await catalogService.getMenu();
    res.set('Cache-Control', PUBLIC_CACHE).json(menu);
  }) satisfies RequestHandler,

  getProduct: (async (req, res) => {
    const { slug } = req.valid.params as { slug: string };
    const product = await catalogService.getProductBySlug(slug);
    res.set('Cache-Control', PUBLIC_CACHE).json(product);
  }) satisfies RequestHandler,
};
