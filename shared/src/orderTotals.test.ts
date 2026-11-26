import { describe, expect, it } from 'vitest';
import { computeOrderTotals, couponDiscount, type CouponRule } from './orderTotals';
import { nextStatusesFor } from './schemas/orders';

const store = { deliveryFee: 2500, minOrderDelivery: 12000, freeDeliveryThreshold: 35000 };

describe('computeOrderTotals', () => {
  it('delivery por debajo del umbral cobra envio e informa cuanto falta', () => {
    const t = computeOrderTotals({ subtotal: 20000, fulfillment: 'delivery', store });
    expect(t).toMatchObject({
      deliveryFee: 2500,
      total: 22500,
      missingForMinimum: 0,
      missingForFreeDelivery: 15000,
    });
  });

  it('delivery desde el umbral tiene envio gratis', () => {
    const t = computeOrderTotals({ subtotal: 35000, fulfillment: 'delivery', store });
    expect(t.deliveryFee).toBe(0);
    expect(t.missingForFreeDelivery).toBeNull();
  });

  it('informa lo que falta para el minimo de delivery', () => {
    expect(
      computeOrderTotals({ subtotal: 9000, fulfillment: 'delivery', store }).missingForMinimum,
    ).toBe(3000);
  });

  it('retiro nunca cobra envio ni exige minimo', () => {
    const t = computeOrderTotals({ subtotal: 5000, fulfillment: 'pickup', store });
    expect(t).toMatchObject({ deliveryFee: 0, total: 5000, missingForMinimum: 0 });
  });

  it('aplica el cupon sobre el subtotal', () => {
    const coupon: CouponRule = { code: 'X', type: 'percent', value: 10, minTotal: 15000 };
    const t = computeOrderTotals({ subtotal: 20000, fulfillment: 'delivery', store, coupon });
    expect(t).toMatchObject({ discount: 2000, total: 20000 + 2500 - 2000 });
  });
});

describe('couponDiscount', () => {
  it('no aplica si no llega al minimo', () => {
    expect(couponDiscount({ code: 'X', type: 'fixed', value: 2000, minTotal: 20000 }, 19999)).toBe(
      0,
    );
  });

  it('el descuento fijo nunca supera el subtotal y el porcentual redondea hacia abajo', () => {
    expect(couponDiscount({ code: 'X', type: 'fixed', value: 5000, minTotal: 0 }, 3000)).toBe(3000);
    expect(couponDiscount({ code: 'X', type: 'percent', value: 10, minTotal: 0 }, 10999)).toBe(
      1099,
    );
  });
});

describe('nextStatusesFor', () => {
  it('filtra la rama segun la modalidad', () => {
    expect(nextStatusesFor('preparing', 'delivery')).toEqual(['on_the_way']);
    expect(nextStatusesFor('preparing', 'pickup')).toEqual(['ready_for_pickup']);
    expect(nextStatusesFor('delivered', 'pickup')).toEqual([]);
  });
});
