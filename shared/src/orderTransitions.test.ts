import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_CANCELLABLE,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  nextStatusesFor,
} from './schemas/orders';

describe('mapa de transiciones de pedidos', () => {
  it('define transiciones para todos los estados', () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('los estados finales no tienen salida', () => {
    for (const s of ['delivered', 'cancelled', 'rejected'] as const) {
      expect(nextStatusesFor(s, 'delivery')).toEqual([]);
      expect(nextStatusesFor(s, 'pickup')).toEqual([]);
    }
  });

  it('un delivery sale "en camino" y nunca pasa por "listo para retirar"', () => {
    expect(nextStatusesFor('preparing', 'delivery')).toEqual(['on_the_way']);
  });

  it('un retiro pasa a "listo para retirar" y nunca sale "en camino"', () => {
    expect(nextStatusesFor('preparing', 'pickup')).toEqual(['ready_for_pickup']);
  });

  it('no se puede volver atras ni saltear pasos', () => {
    expect(nextStatusesFor('confirmed', 'delivery')).not.toContain('pending');
    expect(nextStatusesFor('pending', 'delivery')).not.toContain('delivered');
  });

  it('el cliente solo cancela antes de que empiece la preparacion', () => {
    expect([...CUSTOMER_CANCELLABLE]).toEqual(['pending', 'confirmed']);
    for (const s of CUSTOMER_CANCELLABLE) expect(ORDER_TRANSITIONS[s]).toContain('cancelled');
  });
});
