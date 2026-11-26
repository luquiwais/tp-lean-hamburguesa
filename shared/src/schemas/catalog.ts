import { z } from 'zod';

// =====================================================================
// Contratos del catalogo publico (GET /api/menu, GET /api/products/:slug).
// Montos en pesos argentinos enteros (sin centavos).
// =====================================================================

export const BADGES = ['nuevo', 'picante', 'veggie', 'sin_tacc', 'popular'] as const;
export const badgeSchema = z.enum(BADGES);
export type Badge = z.infer<typeof badgeSchema>;

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug invalido');

export const storeInfoSchema = z.object({
  isOpen: z.boolean(),
  deliveryFee: z.number().int().nonnegative(),
  minOrderDelivery: z.number().int().nonnegative(),
  freeDeliveryThreshold: z.number().int().positive().nullable(),
  etaMin: z.number().int().positive(),
  etaMax: z.number().int().positive(),
});
export type StoreInfo = z.infer<typeof storeInfoSchema>;

// Producto en el listado del menu (card)
export const productSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  basePrice: z.number().int().nonnegative(),
  imageUrl: z.string().nullable(),
  type: z.enum(['simple', 'combo']),
  badges: z.array(badgeSchema),
  isAvailable: z.boolean(),
  // true si tiene algun grupo obligatorio: el front abre el personalizador
  // en vez de agregar directo con el boton "+".
  hasRequiredModifiers: z.boolean(),
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const menuCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  products: z.array(productSummarySchema),
});
export type MenuCategory = z.infer<typeof menuCategorySchema>;

export const menuResponseSchema = z.object({
  store: storeInfoSchema,
  categories: z.array(menuCategorySchema),
});
export type MenuResponse = z.infer<typeof menuResponseSchema>;

// Detalle (personalizador)
export const modifierSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceDelta: z.number().int(),
  maxQuantity: z.number().int().positive(), // >1 permite "x2" (ej: doble cheddar)
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});
export type Modifier = z.infer<typeof modifierSchema>;

export const modifierGroupSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  minSelect: z.number().int().nonnegative(),
  maxSelect: z.number().int().positive(),
  isRequired: z.boolean(), // minSelect > 0
  modifiers: z.array(modifierSchema),
});
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

export const productDetailSchema = productSummarySchema.extend({
  categorySlug: z.string(),
  modifierGroups: z.array(modifierGroupSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;
