// Calculo puro de los totales de un pedido a partir del subtotal (que ya
// sale de unitPrice). El back es la fuente de verdad (lo corre con datos de
// la DB); el front lo puede usar para mostrar el resumen mientras tanto.

export type Fulfillment = 'delivery' | 'pickup';

export interface StoreFees {
  deliveryFee: number;
  minOrderDelivery: number;
  freeDeliveryThreshold: number | null;
}

export interface CouponRule {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minTotal: number;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  // Cuanto falta para el minimo de delivery (0 si llega o es retiro)
  missingForMinimum: number;
  // Cuanto falta para el envio gratis (null si no aplica)
  missingForFreeDelivery: number | null;
}

export function couponDiscount(coupon: CouponRule, subtotal: number): number {
  if (subtotal < coupon.minTotal) return 0;
  const raw =
    coupon.type === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  return Math.min(raw, subtotal); // nunca mas que el subtotal
}

export function computeOrderTotals(input: {
  subtotal: number;
  fulfillment: Fulfillment;
  store: StoreFees;
  coupon?: CouponRule | null;
}): OrderTotals {
  const { subtotal, fulfillment, store, coupon } = input;
  const isDelivery = fulfillment === 'delivery';
  const threshold = store.freeDeliveryThreshold;
  const freeDelivery = threshold !== null && subtotal >= threshold;

  const deliveryFee = isDelivery && !freeDelivery ? store.deliveryFee : 0;
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;

  return {
    subtotal,
    deliveryFee,
    discount,
    total: subtotal + deliveryFee - discount,
    missingForMinimum: isDelivery ? Math.max(0, store.minOrderDelivery - subtotal) : 0,
    missingForFreeDelivery:
      isDelivery && threshold !== null && !freeDelivery ? threshold - subtotal : null,
  };
}
