// =====================================================================
// TEMPORAL — contrato del catalogo que uso el front con datos mock
// (GET /api/categories, /api/products, /api/store).
//
// El contrato oficial es el del back: GET /api/menu y GET /api/products/:slug
// (shared/src/schemas/catalog.ts, referencia en docs/api.md).
// TODO(front): migrar lib/api.ts y los componentes a esos endpoints y borrar
// este archivo junto con src/mocks/.
// =====================================================================
import { z } from 'zod';
import { badgeSchema } from '@burger/shared';

export const idSchema = z.uuid();
const money = z.number().int().nonnegative();

export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
});

export const modifierSchema = z.object({
  id: idSchema,
  name: z.string(),
  priceDelta: z.number().int(),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
  // Tope de unidades del mismo modificador (modifiers.max_quantity, ej.
  // "Cheddar extra x2"). Si es > 1 el front muestra un stepper.
  maxQuantity: z.number().int().min(1).default(1),
});

export const modifierGroupSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    minSelect: z.number().int().nonnegative(),
    maxSelect: z.number().int().positive(),
    modifiers: z.array(modifierSchema),
  })
  .refine((g) => g.minSelect <= g.maxSelect, { message: 'minSelect > maxSelect' });

export const productSchema = z.object({
  id: idSchema,
  categoryId: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  basePrice: money,
  imageUrl: z.url().nullable(),
  type: z.enum(['simple', 'combo']),
  badges: z.array(badgeSchema),
  isAvailable: z.boolean(),
  modifierGroups: z.array(modifierGroupSchema),
});

export const storeSettingsSchema = z.object({
  isOpen: z.boolean(),
  deliveryFee: money,
  minOrderDelivery: money,
  freeDeliveryThreshold: money.nullable(),
  etaMin: z.number().int().positive(),
  etaMax: z.number().int().positive(),
  // Agregado al modelo del plan: hora de cierre "HH:MM" para "Abierto hasta 23:30".
  // En la DB: store_settings.closes_at time.
  closesAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
});

export type Badge = z.infer<typeof badgeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Modifier = z.infer<typeof modifierSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type Product = z.infer<typeof productSchema>;
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
// Forma de entrada (antes de aplicar defaults): la usan los datos crudos/mock.
export type ProductInput = z.input<typeof productSchema>;
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
