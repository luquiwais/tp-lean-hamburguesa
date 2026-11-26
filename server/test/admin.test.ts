import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { adminOrdersPageSchema, dashboardSchema } from '@burger/shared';
import { db, IDS } from './fakeDb';
import { api, createUser, orderBody } from './helpers';

const MISSING_ID = '99999999-0000-4000-8000-000000000000';

async function placeOrder(overrides: Record<string, unknown> = {}) {
  const customer = createUser();
  const res = await api()
    .post('/api/orders')
    .set('Authorization', customer.auth)
    .send(orderBody(overrides));
  return res.body.id as string;
}

const setStatus = (auth: string, id: string, status: string) =>
  api().patch(`/api/admin/orders/${id}/status`).set('Authorization', auth).send({ status });

describe('acceso a /api/admin', () => {
  it.each([
    '/api/admin/dashboard',
    '/api/admin/settings',
    '/api/admin/products',
    '/api/admin/orders',
  ])('%s: 401 sin token y 403 con un cliente', async (path) => {
    expect((await api().get(path)).status).toBe(401);
    const customer = createUser();
    const res = await api().get(path).set('Authorization', customer.auth);
    expect(res.status).toBe(403);
  });

  it('las respuestas del admin no se cachean', async () => {
    const admin = createUser('admin');
    const res = await api().get('/api/admin/settings').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('gestion de pedidos (admin)', () => {
  it('lista la vista de cocina (pedidos activos)', async () => {
    const admin = createUser('admin');
    await placeOrder();
    await placeOrder();

    const res = await api().get('/api/admin/orders?active=true').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(adminOrdersPageSchema.parse(res.body).total).toBe(2);
  });

  it('avanza un delivery por todo el flujo valido y registra el historial', async () => {
    const admin = createUser('admin');
    const id = await placeOrder({
      fulfillment: 'delivery',
      address: { street: 'Calle', number: '1' },
    });

    for (const status of ['confirmed', 'preparing', 'on_the_way', 'delivered']) {
      const res = await setStatus(admin.auth, id, status);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    expect(db.orders.get(id)!.order_status_history.map((h) => h.status)).toEqual([
      'pending',
      'confirmed',
      'preparing',
      'on_the_way',
      'delivered',
    ]);
  });

  it('rechaza transiciones fuera del mapa con 409', async () => {
    const admin = createUser('admin');
    const id = await placeOrder({ fulfillment: 'pickup' });

    // Saltear pasos
    expect((await setStatus(admin.auth, id, 'delivered')).status).toBe(409);

    // Un retiro nunca sale "en camino"
    db.orders.get(id)!.status = 'preparing';
    expect((await setStatus(admin.auth, id, 'on_the_way')).status).toBe(409);
    expect((await setStatus(admin.auth, id, 'ready_for_pickup')).status).toBe(200);

    // Un pedido terminado no cambia mas
    db.orders.get(id)!.status = 'delivered';
    expect((await setStatus(admin.auth, id, 'cancelled')).status).toBe(409);
  });

  it('400 con un estado que no existe; 404 con un pedido inexistente', async () => {
    const admin = createUser('admin');
    const id = await placeOrder();
    expect((await setStatus(admin.auth, id, 'robado')).status).toBe(400);
    expect((await setStatus(admin.auth, MISSING_ID, 'confirmed')).status).toBe(404);
  });

  it('el dashboard resume las ventas sin contar los cancelados', async () => {
    const admin = createUser('admin');
    await placeOrder(); // $12.500
    const cancelled = await placeOrder();
    db.orders.get(cancelled)!.status = 'cancelled';

    const res = await api().get('/api/admin/dashboard').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    const dash = dashboardSchema.parse(res.body);
    expect(dash.activeOrders).toBe(1);
    expect(dash.today).toMatchObject({ orders: 1, revenue: 12500 });
  });
});

describe('configuracion del local y catalogo (admin)', () => {
  it('cerrar el local se refleja al instante en el menu publico (invalida el cache)', async () => {
    const admin = createUser('admin');
    expect((await api().get('/api/menu')).body.store.isOpen).toBe(true); // queda en cache

    const res = await api()
      .patch('/api/admin/settings')
      .set('Authorization', admin.auth)
      .send({ isOpen: false });
    expect(res.status).toBe(200);

    expect((await api().get('/api/menu')).body.store.isOpen).toBe(false);
  });

  it('valida los montos de la configuracion', async () => {
    const admin = createUser('admin');
    const res = await api()
      .patch('/api/admin/settings')
      .set('Authorization', admin.auth)
      .send({ deliveryFee: -100 });
    expect(res.status).toBe(400);
  });

  it('genera el slug desde el nombre y rechaza duplicados con 409', async () => {
    const admin = createUser('admin');
    const created = await api()
      .post('/api/admin/categories')
      .set('Authorization', admin.auth)
      .send({ name: 'Bebidas Frías' });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('bebidas-frias');

    const dup = await api()
      .post('/api/admin/categories')
      .set('Authorization', admin.auth)
      .send({ name: 'Otra', slug: 'hamburguesas' });
    expect(dup.status).toBe(409);
  });

  it('la baja logica saca el producto del menu', async () => {
    const admin = createUser('admin');
    const res = await api()
      .delete(`/api/admin/products/${IDS.coca}`)
      .set('Authorization', admin.auth);
    expect(res.status).toBe(204);
    expect((await api().get('/api/products/coca')).status).toBe(404);
  });
});

describe('POST /api/admin/products/:id/image', () => {
  const upload = (
    auth: string,
    file: Buffer,
    filename: string,
    contentType: string,
    id: string = IDS.clasica,
  ) =>
    api()
      .post(`/api/admin/products/${id}/image`)
      .set('Authorization', auth)
      .attach('image', file, { filename, contentType });

  const png = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#2f6b3a' } })
      .png()
      .toBuffer();

  it('convierte una imagen real a WebP de hasta 800px y reemplaza la anterior', async () => {
    const admin = createUser('admin');
    const image = await png(1600, 1200);

    const first = await upload(admin.auth, image, 'burger.png', 'image/png');
    expect(first.status).toBe(200);
    expect(first.body.imageUrl).toMatch(/\.webp$/);
    expect(db.uploads).toHaveLength(1);

    const second = await upload(admin.auth, image, 'burger2.png', 'image/png');
    expect(second.status).toBe(200);
    expect(db.removedUrls).toEqual([first.body.imageUrl]); // la anterior se borra
  });

  it('rechaza un archivo que dice ser PNG pero no es una imagen', async () => {
    const admin = createUser('admin');
    const fake = Buffer.from('esto es texto plano con extension .png');
    const res = await upload(admin.auth, fake, 'falso.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no es una imagen valida/);
    expect(db.uploads).toHaveLength(0);
  });

  it('rechaza formatos no permitidos por mimetype', async () => {
    const admin = createUser('admin');
    const res = await upload(admin.auth, Buffer.from('GIF89a'), 'x.gif', 'image/gif');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Formato no permitido/);
  });

  it('404 si el producto no existe (no sube nada)', async () => {
    const admin = createUser('admin');
    const res = await upload(admin.auth, await png(10, 10), 'a.png', 'image/png', MISSING_ID);
    expect(res.status).toBe(404);
    expect(db.uploads).toHaveLength(0);
  });
});
