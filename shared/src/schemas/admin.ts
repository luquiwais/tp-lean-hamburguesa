import { z } from 'zod';
import { badgeSchema, slugSchema, storeInfoSchema } from './catalog';
import { fulfillmentSchema, orderStatusSchema } from './orders';

// =====================================================================
// Contratos del panel admin (/api/admin/*)
// =====================================================================

const money = z.number().int().min(0).max(10_000_000);
const name = (max: number) => z.string().trim().min(1, 'Obligatorio').max(max);

// --- Catalogo ------------------------------------------------------------

export const categoryInputSchema = z.object({
  name: name(60),
  slug: slugSchema.optional(), // si no viene, se genera desde el nombre
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});
export const categoryUpdateSchema = categoryInputSchema.partial();
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export const adminCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

export const productInputSchema = z.object({
  categoryId: z.uuid(),
  name: name(80),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).default(''),
  basePrice: money,
  type: z.enum(['simple', 'combo']).default('simple'),
  badges: z.array(badgeSchema).max(5).default([]),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isAvailable: z.boolean().default(true),
  // Reemplaza los grupos del producto (en este orden)
  modifierGroupIds: z.array(z.uuid()).max(20).default([]),
});
export const productUpdateSchema = productInputSchema.partial().extend({
  isActive: z.boolean().optional(), // reactivar un producto dado de baja
});
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export const adminProductSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  basePrice: z.number().int(),
  imageUrl: z.string().nullable(),
  type: z.enum(['simple', 'combo']),
  badges: z.array(badgeSchema),
  sortOrder: z.number().int(),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  modifierGroupIds: z.array(z.uuid()),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;

export const modifierGroupInputSchema = z
  .object({
    code: z
      .string()
      .regex(/^[a-z0-9_]{2,40}$/, 'Solo minusculas, numeros y _')
      .optional(),
    name: name(80),
    description: z.string().trim().max(200).default(''),
    minSelect: z.number().int().min(0).max(20).default(0),
    maxSelect: z.number().int().min(1).max(20).default(1),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: 'El minimo no puede superar al maximo',
    path: ['minSelect'],
  });
export const modifierGroupUpdateSchema = z
  .object({
    name: name(80).optional(),
    description: z.string().trim().max(200).optional(),
    minSelect: z.number().int().min(0).max(20).optional(),
    maxSelect: z.number().int().min(1).max(20).optional(),
  })
  .refine(
    (g) => g.minSelect === undefined || g.maxSelect === undefined || g.minSelect <= g.maxSelect,
    {
      message: 'El minimo no puede superar al maximo',
      path: ['minSelect'],
    },
  );
export type ModifierGroupInput = z.infer<typeof modifierGroupInputSchema>;
export type ModifierGroupUpdate = z.infer<typeof modifierGroupUpdateSchema>;

export const modifierInputSchema = z.object({
  name: name(80),
  priceDelta: z.number().int().min(-1_000_000).max(1_000_000).default(0),
  maxQuantity: z.number().int().min(1).max(10).default(1),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const modifierUpdateSchema = modifierInputSchema.partial();
export type ModifierInput = z.infer<typeof modifierInputSchema>;
export type ModifierUpdate = z.infer<typeof modifierUpdateSchema>;

export const adminModifierGroupSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  minSelect: z.number().int(),
  maxSelect: z.number().int(),
  modifiers: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      priceDelta: z.number().int(),
      maxQuantity: z.number().int(),
      isDefault: z.boolean(),
      isAvailable: z.boolean(),
      sortOrder: z.number().int(),
    }),
  ),
  productCount: z.number().int(), // en cuantos productos se usa
});
export type AdminModifierGroup = z.infer<typeof adminModifierGroupSchema>;

// --- Local -----------------------------------------------------------------

export const adminSettingsSchema = storeInfoSchema.extend({ autoAdvance: z.boolean() });
export type AdminSettings = z.infer<typeof adminSettingsSchema>;

export const settingsUpdateSchema = z
  .object({
    isOpen: z.boolean(),
    deliveryFee: money,
    minOrderDelivery: money,
    freeDeliveryThreshold: money.positive().nullable(),
    etaMin: z.number().int().min(1).max(240),
    etaMax: z.number().int().min(1).max(240),
    autoAdvance: z.boolean(),
  })
  .partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

// --- Pedidos -----------------------------------------------------------------

export const adminOrdersQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  // "activos" = todo lo que no esta terminado (vista de cocina)
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

export const adminOrderSummarySchema = z.object({
  id: z.uuid(),
  orderNumber: z.number().int(),
  status: orderStatusSchema,
  fulfillment: fulfillmentSchema,
  customerName: z.string(),
  total: z.number().int(),
  itemCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminOrdersPageSchema = z.object({
  items: z.array(adminOrderSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type AdminOrdersPage = z.infer<typeof adminOrdersPageSchema>;

// --- Dashboard ---------------------------------------------------------------

const salesBucket = z.object({
  orders: z.number().int(),
  revenue: z.number().int(),
  averageTicket: z.number().int(),
});

export const dashboardSchema = z.object({
  today: salesBucket,
  last7Days: salesBucket,
  last30Days: salesBucket,
  activeOrders: z.number().int(),
  byStatus: z.record(z.string(), z.number().int()),
  byFulfillment: z.object({ delivery: z.number().int(), pickup: z.number().int() }),
  topProducts: z.array(
    z.object({ productName: z.string(), quantity: z.number().int(), revenue: z.number().int() }),
  ),
  salesByDay: z.array(
    z.object({ date: z.string(), revenue: z.number().int(), orders: z.number().int() }),
  ),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
