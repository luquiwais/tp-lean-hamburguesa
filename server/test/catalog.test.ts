import { describe, expect, it, vi } from 'vitest';
import { menuResponseSchema, productDetailSchema } from '@burger/shared';
import { db } from './fakeDb';
import { api } from './helpers';

describe('GET /api/menu', () => {
  it('devuelve el local y las categorias activas con sus productos (contrato de shared)', async () => {
    const res = await api().get('/api/menu');

    expect(res.status).toBe(200);
    const menu = menuResponseSchema.parse(res.body);
    expect(menu.store).toMatchObject({ isOpen: true, deliveryFee: 2500, minOrderDelivery: 12000 });
    expect(menu.categories.map((c) => c.slug)).toEqual(['hamburguesas', 'bebidas']);
  });

  it('no muestra categorias inactivas ni badges desconocidos', async () => {
    const res = await api().get('/api/menu');
    const slugs = res.body.categories.flatMap((c: { products: { slug: string }[] }) =>
      c.products.map((p) => p.slug),
    );
    expect(slugs).not.toContain('oculta');

    const clasica = res.body.categories[0].products.find(
      (p: { slug: string }) => p.slug === 'clasica',
    );
    expect(clasica.badges).toEqual(['nuevo']);
    expect(clasica.hasRequiredModifiers).toBe(true);
  });

  it('si la DB falla responde 500 generico, sin filtrar el error interno', async () => {
    db.failCatalog = true;
    const res = await api().get('/api/menu');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL', message: 'Ocurrio un error inesperado' });
    expect(res.body.traceId).toEqual(expect.any(String));
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('ECONNREFUSED');
    expect(raw).not.toContain('relation');
  });

  it('si la DB falla con el cache vencido, sirve el ultimo dato conocido', async () => {
    await api().get('/api/menu'); // llena el cache (TTL 30 s)
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 60_000); // el cache ya vencio
    db.failCatalog = true;

    const res = await api().get('/api/menu');
    expect(res.status).toBe(200);
    expect(res.body.store.isOpen).toBe(true);
  });
});

describe('GET /api/products/:slug', () => {
  it('devuelve el detalle con los grupos ordenados', async () => {
    const res = await api().get('/api/products/clasica');

    expect(res.status).toBe(200);
    const detail = productDetailSchema.parse(res.body);
    expect(detail.modifierGroups.map((g) => g.code)).toEqual(['pan', 'extras']);
    expect(detail.modifierGroups[0]!.isRequired).toBe(true);
  });

  it('404 para un producto inexistente o de una categoria inactiva', async () => {
    expect((await api().get('/api/products/no-existe')).status).toBe(404);
    expect((await api().get('/api/products/oculta')).status).toBe(404);
  });

  it('400 para un slug con caracteres invalidos (ej: intento de inyeccion)', async () => {
    const res = await api().get(`/api/products/${encodeURIComponent("x' OR '1'='1")}`);
    expect(res.status).toBe(400);
  });
});

describe('errores generales', () => {
  it('ruta inexistente: 404 con el formato de error de la API', async () => {
    const res = await api().get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('JSON mal formado: 400', async () => {
    const res = await api()
      .post('/api/orders/quote')
      .set('Content-Type', 'application/json')
      .send('{"fulfillment": ');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('JSON invalido');
  });

  it('cada respuesta lleva un x-trace-id y helmet saca x-powered-by', async () => {
    const res = await api().get('/api/menu');
    expect(res.headers['x-trace-id']).toEqual(expect.any(String));
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS: solo el origen permitido recibe Access-Control-Allow-Origin', async () => {
    const ok = await api().get('/api/menu').set('Origin', 'http://localhost:5173');
    const evil = await api().get('/api/menu').set('Origin', 'https://evil.example');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
