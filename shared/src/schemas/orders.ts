import { z } from 'zod';
import { phoneSchema } from './auth';

// =====================================================================
// Contratos de pedidos (/api/orders/*, /api/admin/orders/*)
// =====================================================================

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'on_the_way',
  'ready_for_pickup',
  'delivered',
  'cancelled',
  'rejected',
] as const;
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const fulfillmentSchema = z.enum(['delivery', 'pickup']);

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

// --- Request -----------------------------------------------------------

export const orderItemInputSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
  selections: z
    .array(z.object({ modifierId: z.uuid(), quantity: z.number().int().min(1).max(10) }))
    .max(20)
    .default([]),
  notes: optionalText(200),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const addressSchema = z.object({
  street: trimmed(120).min(1, 'Ingresa la calle'),
  number: trimmed(10).min(1, 'Ingresa la altura'),
  apt: optionalText(20),
  betweenStreets: optionalText(120),
  notes: optionalText(200),
});
export type Address = z.infer<typeof addressSchema>;

// Pedir cotizacion (resumen del checkout). No requiere login.
export const quoteRequestSchema = z.object({
  fulfillment: fulfillmentSchema,
  items: z.array(orderItemInputSchema).min(1, 'El carrito esta vacio').max(30),
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'Cupon invalido')
    .optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const cardPaymentSchema = z.object({
  method: z.literal('card'),
  cardNumber: z.string().regex(/^[0-9 ]{13,23}$/, 'Numero de tarjeta invalido'),
  holderName: trimmed(80).min(1, 'Ingresa el nombre del titular'),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(0).max(99), // AA
  cvv: z.string().regex(/^[0-9]{3,4}$/, 'CVV invalido'),
});

const cashPaymentSchema = z.object({
  method: z.literal('cash'),
  cashAmount: z.number().int().positive().max(10_000_000).optional(), // "con cuanto pagas"
});

export const paymentInputSchema = z.discriminatedUnion('method', [
  cardPaymentSchema,
  cashPaymentSchema,
]);
export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const createOrderSchema = quoteRequestSchema
  .extend({
    contact: z.object({
      name: trimmed(80).min(1, 'Ingresa tu nombre'),
      phone: phoneSchema,
    }),
    address: addressSchema.optional(),
    payment: paymentInputSchema,
    notes: optionalText(300),
  })
  .refine((o) => o.fulfillment === 'pickup' || o.address, {
    message: 'Ingresa la direccion de entrega',
    path: ['address'],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const changeStatusSchema = z.object({
  status: orderStatusSchema,
  note: optionalText(200),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// --- Response ----------------------------------------------------------

export const quoteLineSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number().int(),
  itemTotal: z.number().int(),
});

export const quoteResponseSchema = z.object({
  lines: z.array(quoteLineSchema),
  subtotal: z.number().int(),
  deliveryFee: z.number().int(),
  discount: z.number().int(),
  total: z.number().int(),
  missingForMinimum: z.number().int(),
  missingForFreeDelivery: z.number().int().nullable(),
  coupon: z.object({ code: z.string(), discount: z.number().int() }).nullable(),
  // El cupon pedido no aplica (inexistente, vencido, no llega al minimo...)
  couponError: z.string().nullable(),
  storeOpen: z.boolean(),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const orderItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  productName: z.string(),
  unitBasePrice: z.number().int(),
  quantity: z.number().int(),
  itemTotal: z.number().int(),
  notes: z.string().nullable(),
  modifiers: z.array(
    z.object({
      groupName: z.string(),
      modifierName: z.string(),
      priceDelta: z.number().int(),
      quantity: z.number().int(),
    }),
  ),
});

export const orderSummarySchema = z.object({
  id: z.uuid(),
  orderNumber: z.number().int(),
  status: orderStatusSchema,
  fulfillment: fulfillmentSchema,
  total: z.number().int(),
  itemCount: z.number().int(),
  createdAt: z.string(),
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const orderDetailSchema = orderSummarySchema.extend({
  customerName: z.string(),
  customerPhone: z.string(),
  address: addressSchema.nullable(),
  subtotal: z.number().int(),
  deliveryFee: z.number().int(),
  discount: z.number().int(),
  couponCode: z.string().nullable(),
  paymentMethod: z.enum(['cash', 'card']),
  paymentBrand: z.string().nullable(),
  paymentLast4: z.string().nullable(),
  cashAmount: z.number().int().nullable(),
  notes: z.string().nullable(),
  items: z.array(orderItemSchema),
  history: z.array(
    z.object({ status: orderStatusSchema, changedAt: z.string(), note: z.string().nullable() }),
  ),
  canCancel: z.boolean(),
  // Transiciones que puede aplicar un admin desde el estado actual
  nextStatuses: z.array(orderStatusSchema),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

// Mapa de transiciones permitidas (fuente unica: lo usa el service del back
// y el front para mostrar los botones del admin).
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['on_the_way', 'ready_for_pickup'],
  on_the_way: ['delivered'],
  ready_for_pickup: ['delivered'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['pending', 'confirmed'];

// Transiciones validas segun la modalidad: un delivery nunca pasa por
// "listo para retirar" y un retiro nunca sale "en camino".
export function nextStatusesFor(
  status: OrderStatus,
  fulfillment: z.infer<typeof fulfillmentSchema>,
): OrderStatus[] {
  const skip: OrderStatus = fulfillment === 'delivery' ? 'ready_for_pickup' : 'on_the_way';
  return ORDER_TRANSITIONS[status].filter((s) => s !== skip);
}
