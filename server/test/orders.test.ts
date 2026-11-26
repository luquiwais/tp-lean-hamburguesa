import { describe, expect, it } from 'vitest';
import { orderDetailSchema, quoteResponseSchema } from '@burger/shared';
import { db, IDS } from './fakeDb';
import { api, clasicaCompleta, createUser, orderBody, validCard } from './helpers';

const quote = (body: Record<string, unknown>) => api().post('/api/orders/quote').send(body);
const address = { street: 'Av. Siempre Viva', number: '742' };

describe('POST /api/orders/quote (publico)', () => {
  it('recalcula todo con precios de la DB e ignora cualquier precio que mande el cliente', async () => {
    const res = await quote({
      fulfillment: 'pickup',
      items: [{ ...clasicaCompleta(2), unitPrice: 1, price: 1 }],
      total: 1,
      discount: 99999,
    });

    expect(res.status).toBe(200);
    const q = quoteResponseSchema.parse(res.body);
    // (9000 base + 500 pan de papa + 2 x 1500 bacon) x 2
    expect(q.lines[0]).toMatchObject({ unitPrice: 12500, itemTotal: 25000 });
    expect(q).toMatchObject({ subtotal: 25000, deliveryFee: 0, discount: 0, total: 25000 });
  });

  it('delivery: suma el envio y avisa cuanto falta para el minimo y para el envio gratis', async () => {
    const chico = await quote({
      fulfillment: 'delivery',
      items: [{ productId: IDS.coca, quantity: 1 }],
    });
    expect(chico.body).toMatchObject({
      subtotal: 2500,
      deliveryFee: 2500,
      missingForMinimum: 9500,
    });

    const grande = await quote({ fulfillment: 'delivery', items: [clasicaCompleta(3)] });
    expect(grande.body).toMatchObject({ subtotal: 37500, deliveryFee: 0, total: 37500 });
  });

  it('aplica un cupon valido (normalizando mayusculas) y explica por que no aplica uno vencido', async () => {
    const ok = await quote({
      fulfillment: 'pickup',
      items: [clasicaCompleta(2)],
      couponCode: 'bienvenida10',
    });
    expect(ok.body).toMatchObject({
      discount: 2500,
      total: 22500,
      coupon: { code: 'BIENVENIDA10' },
      couponError: null,
    });

    const vencido = await quote({
      fulfillment: 'pickup',
      items: [clasicaCompleta(2)],
      couponCode: 'VENCIDO',
    });
    expect(vencido.body).toMatchObject({
      discount: 0,
      coupon: null,
      couponError: 'El cupon vencio',
    });

    const minimo = await quote({
      fulfillment: 'pickup',
      items: [clasicaCompleta(1)],
      couponCode: 'BIENVENIDA10',
    });
    expect(minimo.body.couponError).toMatch(/compra minima/);
  });

  it.each([
    ['falta un grupo obligatorio (pan)', { productId: IDS.clasica, quantity: 1 }, /Clasica: Eleg/],
    [
      'opcion agotada',
      {
        productId: IDS.clasica,
        quantity: 1,
        selections: [
          { modifierId: IDS.brioche, quantity: 1 },
          { modifierId: IDS.noDisponible, quantity: 1 },
        ],
      },
      /agotado/,
    ],
    [
      'mas cantidad que el maximo del modificador',
      {
        productId: IDS.clasica,
        quantity: 1,
        selections: [
          { modifierId: IDS.brioche, quantity: 1 },
          { modifierId: IDS.bacon, quantity: 3 },
        ],
      },
      /Hasta 2 de Bacon/,
    ],
    [
      'modificador de otro producto',
      { productId: IDS.coca, quantity: 1, selections: [{ modifierId: IDS.bacon, quantity: 1 }] },
      /Opci/,
    ],
    ['producto agotado', { productId: IDS.agotada, quantity: 1 }, /agotado/],
    [
      'producto inexistente',
      { productId: '99999999-0000-4000-8000-000000000000', quantity: 1 },
      /ya no esta disponible/,
    ],
    ['producto de una categoria inactiva', { productId: IDS.oculta, quantity: 1 }, /ya no esta/],
  ])('400 si %s', async (_case, item, message) => {
    const res = await quote({ fulfillment: 'pickup', items: [item] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(message);
  });

  it('400 por validacion de schema: cantidad fuera de rango, id que no es UUID, carrito vacio', async () => {
    const bad = [
      { fulfillment: 'pickup', items: [{ productId: IDS.coca, quantity: 21 }] },
      { fulfillment: 'pickup', items: [{ productId: '1 OR 1=1', quantity: 1 }] },
      { fulfillment: 'pickup', items: [] },
      { fulfillment: 'drone', items: [{ productId: IDS.coca, quantity: 1 }] },
    ];
    for (const body of bad) expect((await quote(body)).status).toBe(400);
  });
});

describe('POST /api/orders (crear pedido)', () => {
  it('sin login: 401', async () => {
    const res = await api().post('/api/orders').send(orderBody());
    expect(res.status).toBe(401);
  });

  it('crea el pedido con el total del server, el user_id del JWT y solo marca + ultimos 4', async () => {
    const user = createUser();
    const other = createUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', user.auth)
      .send(orderBody({ userId: other.id, user_id: other.id, total: 1 }));

    expect(res.status).toBe(201);
    const order = orderDetailSchema.parse(res.body);
    expect(order).toMatchObject({
      status: 'pending',
      total: 12500,
      paymentMethod: 'card',
      paymentBrand: 'visa',
      paymentLast4: '4242',
      canCancel: true,
      nextStatuses: [], // un cliente no ve acciones de admin
    });

    const saved = db.orderPayloads[0]!;
    expect(saved.order.user_id).toBe(user.id); // nunca el del body
    const raw = JSON.stringify(saved);
    expect(raw).not.toContain('4242 4242 4242 4242');
    expect(raw).not.toContain('4242424242424242');
    expect(raw).not.toMatch(/cvv/i);
  });

  it('delivery: guarda la direccion y cobra el envio', async () => {
    const user = createUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', user.auth)
      .send(orderBody({ fulfillment: 'delivery', address }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ deliveryFee: 2500, total: 15000 });
    expect(res.body.address).toMatchObject(address);
  });

  it('aplica el cupon y lo registra en el pedido', async () => {
    const user = createUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', user.auth)
      .send(orderBody({ items: [clasicaCompleta(2)], couponCode: 'BIENVENIDA10' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ discount: 2500, total: 22500, couponCode: 'BIENVENIDA10' });
  });

  it('efectivo: acepta "con cuanto pagas" si alcanza', async () => {
    const user = createUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', user.auth)
      .send(orderBody({ payment: { method: 'cash', cashAmount: 20000 } }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ paymentMethod: 'cash', cashAmount: 20000 });
  });

  it.each([
    [
      'tarjeta de prueba terminada en 0002 (rechazo simulado)',
      { payment: { ...validCard, cardNumber: '4000 0000 0000 0002' } },
      402,
    ],
    [
      'numero que no pasa Luhn',
      { payment: { ...validCard, cardNumber: '4242 4242 4242 4241' } },
      400,
    ],
    ['tarjeta vencida', { payment: { ...validCard, expMonth: 1, expYear: 20 } }, 400],
    ['CVV de 4 digitos en una Visa', { payment: { ...validCard, cvv: '1234' } }, 400],
    ['efectivo que no alcanza', { payment: { method: 'cash', cashAmount: 1000 } }, 400],
    ['delivery sin direccion', { fulfillment: 'delivery' }, 400],
    [
      'delivery por debajo del minimo',
      { fulfillment: 'delivery', address, items: [{ productId: IDS.coca, quantity: 1 }] },
      400,
    ],
    ['cupon que no aplica', { couponCode: 'VENCIDO' }, 400],
  ])('rechaza: %s (%i) y no crea nada', async (_case, overrides, status) => {
    const user = createUser();
    const res = await api()
      .post('/api/orders')
      .set('Authorization', user.auth)
      .send(orderBody(overrides));
    expect(res.status).toBe(status);
    expect(db.orders.size).toBe(0);
  });

  it('local cerrado: 409', async () => {
    db.settings.is_open = false;
    const user = createUser();
    const res = await api().post('/api/orders').set('Authorization', user.auth).send(orderBody());
    expect(res.status).toBe(409);
    expect(db.orders.size).toBe(0);
  });
});

describe('consulta y cancelacion de pedidos', () => {
  async function placeOrder(auth: string) {
    const res = await api().post('/api/orders').set('Authorization', auth).send(orderBody());
    return res.body.id as string;
  }

  it('/mine lista solo los pedidos propios', async () => {
    const ana = createUser();
    const beto = createUser();
    await placeOrder(ana.auth);
    await placeOrder(ana.auth);
    await placeOrder(beto.auth);

    const res = await api().get('/api/orders/mine').set('Authorization', ana.auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('un pedido ajeno da 404 (no se revela que existe); el admin si lo ve', async () => {
    const ana = createUser();
    const beto = createUser();
    const admin = createUser('admin');
    const id = await placeOrder(ana.auth);

    expect((await api().get(`/api/orders/${id}`).set('Authorization', beto.auth)).status).toBe(404);
    const asAdmin = await api().get(`/api/orders/${id}`).set('Authorization', admin.auth);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.nextStatuses).toEqual(['confirmed', 'rejected', 'cancelled']);
  });

  it('id que no es UUID: 400', async () => {
    const ana = createUser();
    const res = await api().get('/api/orders/123').set('Authorization', ana.auth);
    expect(res.status).toBe(400);
  });

  it('el cliente cancela un pedido pendiente; cancelarlo de nuevo da 409', async () => {
    const ana = createUser();
    const id = await placeOrder(ana.auth);

    const first = await api().post(`/api/orders/${id}/cancel`).set('Authorization', ana.auth);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: 'cancelled', canCancel: false });
    expect(first.body.history.map((h: { status: string }) => h.status)).toEqual([
      'pending',
      'cancelled',
    ]);

    const again = await api().post(`/api/orders/${id}/cancel`).set('Authorization', ana.auth);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('El pedido ya estaba cancelado');
  });

  it('no se puede cancelar un pedido en preparacion, ni uno ajeno', async () => {
    const ana = createUser();
    const beto = createUser();
    const id = await placeOrder(ana.auth);

    expect(
      (await api().post(`/api/orders/${id}/cancel`).set('Authorization', beto.auth)).status,
    ).toBe(404);

    db.orders.get(id)!.status = 'preparing';
    const res = await api().post(`/api/orders/${id}/cancel`).set('Authorization', ana.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/preparacion/);
  });
});
