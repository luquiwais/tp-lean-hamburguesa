import {
  computeOrderTotals,
  CUSTOMER_CANCELLABLE,
  nextStatusesFor,
  unitPrice,
  validateSelections,
  type CouponRule,
  type CreateOrderInput,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  type ProductDetail,
  type QuoteRequest,
  type QuoteResponse,
  type Role,
} from '@burger/shared';
import { badRequest, conflict, notFound } from '../lib/errors';
import { formatARS } from '../lib/format';
import type { Logger } from '../logger';
import { catalogRepository } from '../repositories/catalog.repository';
import { couponRepository, type CouponRow } from '../repositories/coupon.repository';
import {
  orderRepository,
  type CreateOrderItemPayload,
  type OrderRow,
} from '../repositories/order.repository';
import { toProductDetail } from './catalog.service';
import { paymentService } from './payment.service';

interface Actor {
  id: string;
  role: Role;
}

// ---------------------------------------------------------------------
// Cotizacion: TODO se recalcula con datos de la DB. Del cliente solo se
// usan ids, cantidades y selecciones; nunca precios.
// ---------------------------------------------------------------------

interface PricedQuote {
  quote: QuoteResponse;
  items: CreateOrderItemPayload[];
  coupon: CouponRow | null;
}

function couponProblem(row: CouponRow | null, subtotal: number): string | null {
  if (!row || !row.is_active) return 'El cupon no existe';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'El cupon vencio';
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return 'El cupon ya no tiene usos disponibles';
  }
  if (subtotal < row.min_total) {
    return `El cupon requiere una compra minima de ${formatARS(row.min_total)}`;
  }
  return null;
}

async function priceOrder(input: QuoteRequest): Promise<PricedQuote> {
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const [settings, rows] = await Promise.all([
    catalogRepository.getStoreSettings(),
    catalogRepository.findActiveProductsByIds(productIds),
  ]);

  const products = new Map<string, ProductDetail>();
  for (const row of rows) {
    const detail = toProductDetail(row);
    if (detail) products.set(detail.id, detail);
  }

  const items: CreateOrderItemPayload[] = input.items.map((item, index) => {
    const product = products.get(item.productId);
    if (!product) {
      throw badRequest('Un producto del carrito ya no esta disponible', { itemIndex: index });
    }
    if (!product.isAvailable) {
      throw badRequest(`${product.name} esta agotado`, { itemIndex: index });
    }

    // Mismas reglas que el personalizador del front (shared/pricing.ts)
    const issues = validateSelections(product, item.selections);
    if (issues.length > 0) {
      throw badRequest(`${product.name}: ${issues[0]!.message}`, { itemIndex: index, issues });
    }

    const unit = unitPrice(product, item.selections);
    const modifiers = item.selections.map((sel) => {
      const group = product.modifierGroups.find((g) =>
        g.modifiers.some((m) => m.id === sel.modifierId),
      )!;
      const modifier = group.modifiers.find((m) => m.id === sel.modifierId)!;
      return {
        modifier_id: modifier.id,
        group_name: group.name,
        modifier_name: modifier.name,
        price_delta: modifier.priceDelta,
        quantity: sel.quantity,
      };
    });

    return {
      product_id: product.id,
      product_name: product.name,
      unit_base_price: product.basePrice,
      quantity: item.quantity,
      item_total: unit * item.quantity,
      notes: item.notes ?? null,
      modifiers,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.item_total, 0);

  let coupon: CouponRow | null = null;
  let couponError: string | null = null;
  if (input.couponCode) {
    const row = await couponRepository.findByCode(input.couponCode);
    couponError = couponProblem(row, subtotal);
    if (!couponError) coupon = row;
  }

  const couponRule: CouponRule | null = coupon && {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minTotal: coupon.min_total,
  };

  const totals = computeOrderTotals({
    subtotal,
    fulfillment: input.fulfillment,
    store: {
      deliveryFee: settings.delivery_fee,
      minOrderDelivery: settings.min_order_delivery,
      freeDeliveryThreshold: settings.free_delivery_threshold,
    },
    coupon: couponRule,
  });

  return {
    items,
    coupon,
    quote: {
      lines: items.map((i) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.item_total / i.quantity,
        itemTotal: i.item_total,
      })),
      ...totals,
      coupon: coupon ? { code: coupon.code, discount: totals.discount } : null,
      couponError,
      storeOpen: settings.is_open,
    },
  };
}

// ---------------------------------------------------------------------
// Mapeos fila -> contrato
// ---------------------------------------------------------------------

function toDetail(row: OrderRow, actor: Actor): OrderDetail {
  const isOwner = row.user_id === actor.id;
  const a = row.address_snapshot;
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    fulfillment: row.fulfillment,
    total: row.total,
    itemCount: row.order_items.reduce((n, i) => n + i.quantity, 0),
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    address: a
      ? {
          street: a.street ?? '',
          number: a.number ?? '',
          apt: a.apt ?? undefined,
          betweenStreets: a.between_streets ?? undefined,
          notes: a.notes ?? undefined,
        }
      : null,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    discount: row.discount,
    couponCode: row.coupon_code,
    paymentMethod: row.payment_method,
    paymentBrand: row.payment_brand,
    paymentLast4: row.payment_last4,
    cashAmount: row.cash_amount,
    notes: row.notes,
    items: row.order_items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      unitBasePrice: i.unit_base_price,
      quantity: i.quantity,
      itemTotal: i.item_total,
      notes: i.notes,
      modifiers: i.order_item_modifiers.map((m) => ({
        groupName: m.group_name,
        modifierName: m.modifier_name,
        priceDelta: m.price_delta,
        quantity: m.quantity,
      })),
    })),
    history: row.order_status_history.map((h) => ({
      status: h.status,
      changedAt: h.changed_at,
      note: h.note,
    })),
    canCancel: isOwner && CUSTOMER_CANCELLABLE.includes(row.status),
    nextStatuses: actor.role === 'admin' ? nextStatusesFor(row.status, row.fulfillment) : [],
  };
}

// Pedido inexistente o ajeno: mismo 404 (no se revela que existe).
async function loadVisibleOrder(orderId: string, actor: Actor): Promise<OrderRow> {
  const row = await orderRepository.findById(orderId);
  if (!row || (row.user_id !== actor.id && actor.role !== 'admin')) {
    throw notFound('Pedido no encontrado');
  }
  return row;
}

// ---------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------

export const orderService = {
  async quote(input: QuoteRequest): Promise<QuoteResponse> {
    return (await priceOrder(input)).quote;
  },

  async create(input: CreateOrderInput, actor: Actor, log: Logger): Promise<OrderDetail> {
    const { quote, items, coupon } = await priceOrder(input);

    if (!quote.storeOpen) throw conflict('El local esta cerrado en este momento');
    if (input.couponCode && quote.couponError) throw badRequest(quote.couponError);
    if (quote.missingForMinimum > 0) {
      throw badRequest(
        `Te faltan ${formatARS(quote.missingForMinimum)} para el minimo de delivery`,
      );
    }

    // Pago simulado (lanza 400/402 si la tarjeta no pasa)
    const payment = paymentService.process(input.payment, quote.total);

    const address = input.fulfillment === 'delivery' ? input.address! : null;
    const created = await orderRepository.create(
      {
        user_id: actor.id, // SIEMPRE del JWT, nunca del body
        fulfillment: input.fulfillment,
        customer_name: input.contact.name,
        customer_phone: input.contact.phone,
        address_snapshot: address && {
          street: address.street,
          number: address.number,
          apt: address.apt ?? null,
          between_streets: address.betweenStreets ?? null,
          notes: address.notes ?? null,
        },
        subtotal: quote.subtotal,
        delivery_fee: quote.deliveryFee,
        discount: quote.discount,
        total: quote.total,
        coupon_id: coupon?.id ?? null,
        coupon_code: coupon?.code ?? null,
        payment_method: payment.method,
        payment_brand: payment.brand,
        payment_last4: payment.last4,
        cash_amount: payment.cashAmount,
        notes: input.notes ?? null,
      },
      items,
    );

    log.info('order_created', {
      order_id: created.id,
      order_number: created.order_number,
      total: quote.total,
      items: items.length,
    });
    return this.getById(created.id, actor);
  },

  async listMine(actor: Actor): Promise<OrderSummary[]> {
    const rows = await orderRepository.listByUser(actor.id);
    return rows.map((r) => ({
      id: r.id,
      orderNumber: r.order_number,
      status: r.status,
      fulfillment: r.fulfillment,
      total: r.total,
      itemCount: r.order_items.reduce((n, i) => n + i.quantity, 0),
      createdAt: r.created_at,
    }));
  },

  async getById(orderId: string, actor: Actor): Promise<OrderDetail> {
    return toDetail(await loadVisibleOrder(orderId, actor), actor);
  },

  async cancel(orderId: string, actor: Actor): Promise<OrderDetail> {
    const row = await loadVisibleOrder(orderId, actor);
    if (row.user_id !== actor.id) throw notFound('Pedido no encontrado');
    if (!CUSTOMER_CANCELLABLE.includes(row.status)) {
      const reason: Partial<Record<OrderStatus, string>> = {
        cancelled: 'El pedido ya estaba cancelado',
        rejected: 'El pedido fue rechazado por el local',
        delivered: 'El pedido ya fue entregado',
      };
      throw conflict(
        reason[row.status] ?? 'El pedido ya esta en preparacion y no se puede cancelar',
      );
    }
    await applyTransition(row, 'cancelled', actor.id, 'Cancelado por el cliente');
    return this.getById(orderId, actor);
  },

  // Admin: valida contra el mapa de transiciones segun la modalidad.
  async changeStatus(
    orderId: string,
    to: OrderStatus,
    actor: Actor,
    note?: string,
  ): Promise<OrderDetail> {
    const row = await loadVisibleOrder(orderId, actor);
    if (!nextStatusesFor(row.status, row.fulfillment).includes(to)) {
      throw conflict(`No se puede pasar de "${row.status}" a "${to}"`);
    }
    await applyTransition(row, to, actor.id, note);
    return this.getById(orderId, actor);
  },
};

async function applyTransition(
  row: OrderRow,
  to: OrderStatus,
  changedBy: string,
  note?: string,
): Promise<void> {
  const applied = await orderRepository.changeStatus({
    orderId: row.id,
    from: row.status,
    to,
    changedBy,
    note,
  });
  if (!applied) throw conflict('El pedido cambio de estado mientras tanto. Actualiza y reintenta.');
}
