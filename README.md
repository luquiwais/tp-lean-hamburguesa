# tp-lean-hamburguesa

E-commerce de una hamburguesería (TP): menú, personalización de pedidos, carrito, compra simulada,
auth JWT y panel admin.

**Stack:** React 19 + TypeScript + Tailwind v4 + shadcn/ui (client) · Node + Express 5 +
TypeScript en capas (server) · Supabase (Postgres + Storage) · Zod compartido (shared) · Vitest +
Supertest.

## Estructura

```
client/     Vite + React + Tailwind v4 + shadcn/ui
server/     Express por capas: routes -> controllers -> services -> repositories
  test/     Tests de la API (Supertest) con una base en memoria
shared/     Schemas Zod, tipos y logica pura compartida (precios, totales, pagos)
supabase/   Migraciones SQL, funciones RPC y seed
docs/       Plan, referencia de la API, notas para el front y registro de prompts
```

## Cómo correrlo

Requiere Node 20.19+ y un proyecto de Supabase (el plan gratis alcanza).

```bash
npm install
cp server/.env.example server/.env   # completar SUPABASE_* y los JWT_* (ver el archivo)

# Base de datos: crea tablas, funciones, bucket y datos de ejemplo
npx supabase link --project-ref <ref-del-proyecto>
npx supabase db push --remote --include-seed

# Usuario admin (pide la contrasena por consola, sin eco)
npm run create-admin -w server -- --email admin@burger.com --name "Admin"

npm run dev                          # server en :4000, client en :5173
```

El front usa datos mock hasta terminar la integración. Para probar contra la API real:
`VITE_USE_MOCKS=false npm run dev`.

| Script              | Qué hace                                        |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Levanta server y client juntos                  |
| `npm run build`     | Build de producción de server y client          |
| `npm run typecheck` | Chequeo de tipos en los 3 paquetes              |
| `npm test`          | Todos los tests (shared + API), sin tocar la DB |
| `npm run lint`      | ESLint en todo el repo                          |
| `npm run format`    | Prettier                                        |

## Tests

`npm test` corre **103 tests** en unos 20 segundos:

- **shared:** reglas de personalización y precio, totales con envío y cupones, validación de
  tarjetas (Luhn, marca, vencimiento), slugs y el mapa de transiciones de pedidos.
- **server (Supertest):** levantan la app de Express real (rutas, middlewares, validación,
  services y manejo de errores). Solo se reemplaza la capa `repositories` por una base en memoria
  (`server/test/fakeDb.ts`), así que no necesitan Supabase ni secretos y corren igual en el CI.
  - **Auth:** registro, login, refresh con rotación, detección de reuso (revoca la sesión), logout,
    tokens adulterados, `alg: none` y rate limit.
  - **Catálogo y errores:** contrato del menú, 404 y 400, errores internos que no se filtran,
    fallback al último menú conocido, CORS y headers.
  - **Pedidos:** precios recalculados en el server (se ignoran los del cliente), `user_id` del JWT,
    solo marca y últimos 4 de la tarjeta, rechazo simulado, cupones, mínimo de delivery y
    cancelación.
  - **Admin:** 401 y 403, flujo de estados y transiciones inválidas, dashboard, invalidación del
    caché del menú, y subida de imágenes (contenido real, formato y tamaño).

El CI (`.github/workflows/ci.yml`) corre typecheck, lint, formato, tests y build en cada push.

## Decisiones principales

| Tema           | Decisión                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso a datos | supabase-js con la service key **solo en el back**; RLS activo sin policies (la key pública no lee nada)                                           |
| Transacciones  | Funciones RPC de Postgres: `create_order` (pedido + items + cupón atómico) y `change_order_status` (concurrencia optimista)                        |
| Auth           | Propia: bcrypt (costo 12), access JWT HS256 de 15 min en memoria, refresh opaco de 7 días en cookie httpOnly con rotación y revocación por familia |
| Precios        | El server recalcula todo desde la DB con la misma lógica que el front (`shared/pricing.ts`); del cliente solo se usan ids y cantidades             |
| Pagos          | Simulados: Luhn, marca, vencimiento y CVV; la tarjeta terminada en `0002` se rechaza. Solo se guardan marca y últimos 4                            |
| Estados        | Mapa de transiciones explícito según delivery o retiro; auto-avance opcional para la demo                                                          |
| Imágenes       | Supabase Storage; se valida el contenido con sharp y se normaliza a WebP de 800px                                                                  |
| Seguridad      | Zod en body, params y query; helmet; CORS con lista blanca; rate limit en login, registro, cotización y pedidos; errores genéricos con `traceId`   |
| Observabilidad | Logs JSON estructurados con `trace_id` por request (header `x-trace-id`)                                                                           |
| Rendimiento    | Menú en 1 request con caché de 30 s, coalescing y fallback al último dato conocido                                                                 |

Más detalle en [docs/plan.md](docs/plan.md) (plan y decisiones), [docs/api.md](docs/api.md)
(referencia de la API) y [docs/notas-jose.md](docs/notas-jose.md) (integración del front).
