# Plan — TP E-commerce Hamburguesería

## Context

TP universitario: e-commerce de **una sola hamburguesería** con menú, personalización de pedidos, carrito, compra simulada, auth JWT y panel admin. Stack obligatorio: Node.js + React + TypeScript + Tailwind, backend en capas (routes → controllers → services → repositories), DB Supabase. Storage de imágenes gratis. Repo vacío (solo initial commit). Se investigó con 3 agentes: features, diseño, y apps de delivery (PedidosYa, DoorDash, Uber Eats, Toast, Domino's, Starbucks). No es un oneshot: se construye por fases y se revisa cada una.

Los prompts textuales están en [prompts.md](prompts.md).

---

## Decisiones

### Tomadas

| #   | Decisión                     | Elección                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Dirección visual             | **Clean/fresh (Shake Shack)**: blanco `#FFFFFF`, hueso `#F7F5F0`, carbón `#1F2421`, verde `#2F6B3A` (CTA), tomate `#B8391F` (acentos). Títulos Space Grotesk o Fraunces, cuerpo Inter. Fotos con luz natural y cenitales, mucho aire, ilustración de línea fina. Tono cálido, con voseo. |
| D2  | Pausa de Supabase free       | No es problema (es un TP)                                                                                                                                                                                                                                                                |
| D3  | Flujo de auth                | **Navegar como invitado, login al confirmar el pedido**                                                                                                                                                                                                                                  |
| D4  | Tokens JWT                   | **Access de 15 min en memoria + refresh de 7 días en cookie httpOnly con rotación y revocación en la DB**                                                                                                                                                                                |
| D6  | Acceso a la DB desde el back | **supabase-js con service role solo en el backend + funciones RPC de Postgres para transacciones**                                                                                                                                                                                       |
| D9  | Extras fuera del MVP         | **Cupones + barra de envío gratis** (tabla `coupons`: code, type %/fijo, value, min_total, expires_at, max_uses, is_active; validación en el back)                                                                                                                                       |
| D5  | Implementación de auth       | **Propia**: tabla `users`, bcrypt, `jsonwebtoken`, middlewares propios                                                                                                                                                                                                                   |
| D7  | Storage de imágenes          | **Supabase Storage** (default), bucket público `products`, resize a WebP de 800px con `sharp`                                                                                                                                                                                            |
| D8  | Avance de estados del pedido | **Manual desde el admin + toggle de auto-avance** (job cada ~45 s)                                                                                                                                                                                                                       |
| D10 | Estructura del repo          | **Monorepo con npm workspaces** (default): `client/`, `server/`, `shared/`                                                                                                                                                                                                               |
| D11 | Librería de UI               | **shadcn/ui + Tailwind v4 + lucide-react + motion**                                                                                                                                                                                                                                      |
| D12 | Deploy                       | **Gratis, en la última fase**: front en Vercel, back en Render free                                                                                                                                                                                                                      |
| D13 | RLS en Supabase              | **Automático activado**, sin policies públicas (el backend usa service role, que lo bypassea). Data API activada (la usa supabase-js). Región sa-east-1                                                                                                                                  |

Fase 7 (extras) = cupones + barra de envío gratis. Fase 9 = deploy.

---

## Alcance (MVP; los extras dependen de D9)

- **Menú**: header del local (hero, ETA "30-45 min", chip de envío, "Abierto hasta 23:30"), nav de categorías sticky con scroll-spy, sección "Más pedidos", cards (en mobile, lista con foto a la derecha; en desktop, grilla), badges (Nuevo, Picante, Veggie, Sin TACC), botón "+" rápido si no tiene grupos obligatorios.
- **Personalizador**: modal en desktop, bottom sheet en mobile, ruta `/menu/:slug`. Grupos con su regla visible ("Obligatorio · Elegí 1", "Hasta 3"), radio o checkbox o stepper, quitar ingredientes, notas, CTA fijo "Agregar 2 · $ 18.400" deshabilitado hasta completar lo obligatorio.
- **Carrito**: persistente (localStorage como invitado, se sincroniza al loguearse), drawer en desktop o página en mobile, barra fija "Ver pedido (3) · $X", ítems editables con su personalización, mensaje "Te faltan $X para el mínimo".
- **Checkout en una página**: delivery o retiro, dirección (calle, número, piso/depto, entre calles, referencias), pago (efectivo con "¿con cuánto pagás?", o tarjeta simulada con validación Luhn, marca detectada por prefijo y vencimiento a futuro; tarjeta terminada en 0002 = rechazo simulado), resumen desglosado. Se guardan solo `last4` y la marca, nunca el número completo ni el CVV.
- **Post-compra**: confirmación, tracker con línea de tiempo (Recibido, En preparación, En camino o Listo para retirar, Entregado) con polling cada 10 s, "Mis pedidos", cancelación en `pending` o `confirmed`.
- **Admin**: dashboard básico, CRUD de productos, categorías y grupos/modificadores, subida de imágenes, toggle de agotado, local abierto/cerrado, pedidos en tabla o kanban con el botón "siguiente estado".
- **Convenciones AR**: `Intl.NumberFormat('es-AR', {style:'currency', currency:'ARS', maximumFractionDigits:0})`, voseo, sin service fee (se evita el drip pricing), envío y mínimo visibles desde el header.

## Modelo de datos (Supabase/Postgres; montos en INTEGER de pesos, sin floats)

```
categories(id uuid, name, slug, sort_order, is_active)
products(id, category_id, name, slug, description, base_price, image_url, type['simple'|'combo'], badges text[], is_available, is_active, created_at)
modifier_groups(id, name, min_select, max_select, sort_order)
modifiers(id, group_id, name, price_delta, is_default, is_available, sort_order)
product_modifier_groups(product_id, group_id, sort_order)  PK(product_id, group_id)
users(id, email unique, password_hash, name, phone, role['customer'|'admin'], created_at)
addresses(id, user_id, street, number, apt, between_streets, notes)
refresh_tokens(id, user_id, token_hash, expires_at, revoked_at)
store_settings(id=1, is_open, delivery_fee, min_order_delivery, free_delivery_threshold, eta_min, eta_max)
orders(id, user_id, status, fulfillment['delivery'|'pickup'], address_snapshot jsonb, subtotal, delivery_fee, discount, total,
       payment_method['cash'|'card'], payment_last4, payment_brand, cash_amount, notes, created_at, updated_at)
order_items(id, order_id, product_id, product_name, unit_base_price, quantity, item_total, notes)
order_item_modifiers(id, order_item_id, modifier_id, group_name, modifier_name, price_delta, quantity)
order_status_history(id, order_id, status, changed_by, changed_at)
-- según D9: coupons, points_ledger, reviews
```

- **Snapshot de precios**: al crear el pedido se copian nombres y precios en `order_items` y `order_item_modifiers`.
- **Pedido en una transacción**: función RPC `create_order(...)` en Postgres.
- **RLS** activado en todas las tablas sin policies públicas: el único acceso es el backend con la service role.

## Arquitectura

### Backend (`server/`)

Express + TS, por capas:

```
server/src/
  app.ts, index.ts
  config/env.ts            (validación de env con Zod)
  logger.js|ts             (JSON estructurado con trace_id, regla global)
  middlewares/             traceId, authenticate, authorize(role), validate(schema), rateLimit, errorHandler, upload(multer)
  routes/                  auth, products, categories, orders, admin/*, uploads
  controllers/             parsean req y llaman al service; sin lógica de negocio
  services/                auth, catalog, cart-pricing (recalcula los precios desde la DB), orders (mapa de transiciones), storage, payments.sim (Luhn)
  repositories/            únicos que hablan con supabase-js
  lib/supabase.ts, lib/jwt.ts, lib/errors.ts
```

- **Mapa de transiciones** en `services/orders`: `{pending:['confirmed','cancelled','rejected'], confirmed:['preparing','cancelled'], preparing:['on_the_way','ready_for_pickup'], on_the_way:['delivered'], ready_for_pickup:['delivered']}`.
- **Seguridad** (reglas globales):
  - Zod en el body, los query params y los params (UUIDs).
  - Precio recalculado en el server.
  - `user_id` tomado del JWT, nunca del body.
  - `helmet`, CORS con lista de orígenes permitidos y `credentials`.
  - `express-rate-limit` en login, registro y creación de pedidos.
  - Errores genéricos al cliente y `console.error`/logger internamente.
  - `crypto.timingSafeEqual` para comparar hashes de refresh tokens.
  - Validación de uploads: mimetype real con `sharp`, máximo 2 MB.

### Frontend (`client/`)

Vite + React + TS + Tailwind v4 (`@theme` con los tokens de D1) + shadcn/ui.

```
client/src/
  app/router.tsx           React Router; rutas protegidas para cliente y admin
  lib/api.ts               fetchWithRetry (3 intentos, 300/600/1200 ms con jitter, sin reintentar 4xx, dedup de GETs), refresh automático en 401
  lib/format.ts            formatARS
  features/menu, product-customizer, cart (Zustand + persist), checkout, orders, auth, admin/*
  components/ui/           shadcn
```

- Datos del servidor con TanStack Query (stale-while-revalidate y updates optimistas en el admin).

### `shared/`

Schemas Zod (producto, payload del pedido, auth) y tipos inferidos, usados por los dos lados.

## Fases (cada una se revisa antes de seguir)

0. [HECHO] `docs/prompts.md`, scaffolding del monorepo, ESLint/Prettier, `.env.example`, `.gitignore` (incluye `.env` y memoria).
1. [HECHO] Supabase vía CLI (`npx supabase db push --remote --include-seed`): migraciones (schema + funciones `create_order` / `change_order_status`), seed (19 productos, 8 grupos, 30 modificadores, 2 cupones), bucket `products`, RLS verificado con la key pública. El admin se crea en Fase 3 con `npm run create-admin -w server` (bcrypt en el backend).
2. [HECHO] Backend base: `GET /api/menu` (store + categorías + productos, 1 request, caché 30 s con coalescing) y `GET /api/products/:slug` (grupos + modificadores). Middleware `validate` (Zod), `lib/cache.ts`, contratos en `shared/src/schemas/catalog.ts`, referencia para el front en `docs/api.md`.
3. [HECHO] Auth propia: register, login, refresh con rotación y detección de reuso (revoca la familia), logout, me. bcrypt (costo 12) + JWT HS256 de 15 min + refresh opaco con HMAC en la DB y cookie httpOnly (path /api/auth). Middlewares `authenticate` y `authorize`, rate limit en login y registro, `/api/admin` protegido, script `npm run create-admin -w server`. Probado de punta a punta contra la DB.
4. [HECHO, con catálogo mock] Frontend base: tokens de diseño, layout, menú, personalizador, carrito. Ver notas abajo.
5. [HECHO, back] Pedidos + cupones (se unificó con la 7): `POST /api/orders/quote` (público), `POST /api/orders` (precio recalculado con `shared/pricing.ts`, mínimo de delivery, envío gratis, cupón consumido en la transacción, tarjeta simulada con Luhn y rechazo 0002), `GET /mine`, `GET /:id`, `POST /:id/cancel`, `PATCH /api/admin/orders/:id/status` con mapa de transiciones según la modalidad. Probado de punta a punta (37 casos). Front pendiente (José).
6. [HECHO, back] Admin: dashboard (ventas hoy/7/30 días, top 5, por estado, ventas por día), listado de pedidos con filtros y vista de cocina, configuración del local, CRUD de categorías, productos (baja lógica) y grupos/opciones, subida de imágenes (multer + sharp → WebP 800px en Supabase Storage, validación por contenido), auto-avance de estados para la demo (job de 45 s). Probado de punta a punta (35 casos). Front pendiente (José).
7. [HECHO, back] Cupones y envío gratis: incluidos en la Fase 5 (`quote` devuelve `couponError` y `missingForFreeDelivery`).
8. [HECHO, back] Tests y pulido: 103 tests con Vitest (`npm test`). En shared: precios, totales, pagos, slugs y transiciones. En server: tests de la API con Supertest sobre la app real, con los repositories reemplazados por una base en memoria (`server/test/fakeDb.ts`), así que no tocan Supabase y corren en CI. Cubren auth (rotación, reuso, tokens adulterados, rate limit), catálogo y errores (sin filtrar internos, fallback de caché, CORS), pedidos (precio del server, `user_id` del JWT, tarjeta, cupones, mínimo) y admin (403, transiciones, imágenes). CI en GitHub Actions y README con setup y decisiones. Estados vacíos, skeletons y accesibilidad quedan del lado del front (José).
9. Deploy: front en Vercel, back en Render free.

## Notas de la Fase 4 (para quien haga el back)

- **Contrato del catálogo (DECIDIDO: el del back)**: `GET /api/menu` (store + categorías + productos resumidos) y `GET /api/products/:slug` (detalle con grupos y modificadores). Schemas en `shared/src/schemas/catalog.ts`, referencia en `docs/api.md`, guía de migración del front en `docs/notas-jose.md`. El contrato que usó el front con mocks (`/categories`, `/products`, `/store`) quedó en `client/src/lib/catalogContract.ts` como TEMPORAL: el front tiene que migrar a los endpoints reales y después borrarlo.
- **Contra la DB de la Fase 1**: `modifiers.max_quantity` ya está (si es > 1, el personalizador muestra un stepper) y "Más pedidos" sale del badge `popular`. Falta `store_settings.closes_at time` para "Abierto hasta las 23:30" (el contrato lo acepta `null` y muestra "Abierto ahora").
- **Reglas y precio compartidos** en `shared/src/pricing.ts` (`validateSelections`, `unitPrice`): el `POST /orders` de la Fase 5 tiene que usar las mismas funciones con los datos de la DB. Tests en `shared/src/pricing.test.ts`.
- **Mock**: `client/src/mocks/catalog.ts` tiene el catálogo de ejemplo (sirve de base para el seed de la Fase 1). Se apaga con `VITE_USE_MOCKS=false`; cuando el back esté, se borra.
- **Pendiente** de esta fase: sincronizar el carrito con la cuenta al loguearse (necesita la auth de la Fase 3).

## Verificación

- `npm run dev` levanta el client y el server. Flujo manual: navegar como invitado, personalizar, agregar, loguearse, checkout con tarjeta válida, ver el tracker, avanzar estados desde el admin y ver cómo cambian para el cliente.
- Tarjeta 0002 → rechazo; grupo obligatorio sin elegir → 400; precio manipulado en el request → se ignora; transición inválida → 409; ruta de admin con token de cliente → 403.
- `npm test` corre los tests de pricing, transiciones y auth.
- Mini-auditoría final: SQLi, XSS, auth bypass, secretos expuestos (service role nunca en el client), validación.
