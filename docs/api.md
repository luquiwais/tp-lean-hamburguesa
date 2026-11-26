# API — Referencia para el front

Base: `/api`. En desarrollo, Vite redirige `/api` a `http://localhost:4000`, así que desde el client
se llama directo a `fetch('/api/menu')` (mismo origen, sin CORS).

Todos los tipos y schemas Zod están en `@burger/shared`: importalos en vez de redefinirlos.

```ts
import { menuResponseSchema, type MenuResponse, type ProductDetail } from '@burger/shared';
```

**Montos:** pesos argentinos enteros (sin centavos). Formatear con
`new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })`.

## Formato de error (todas las rutas)

```json
{
  "error": { "code": "NOT_FOUND", "message": "Producto no encontrado", "details": {} },
  "traceId": "10a40c50-..."
}
```

| HTTP | `code`              | Cuándo                                                                                   |
| ---- | ------------------- | ---------------------------------------------------------------------------------------- |
| 400  | `BAD_REQUEST`       | Input inválido. `details` trae los errores por campo                                     |
| 401  | `UNAUTHORIZED`      | Falta login o token vencido (Fase 3)                                                     |
| 403  | `FORBIDDEN`         | Logueado pero sin permiso (ej: cliente en ruta admin)                                    |
| 404  | `NOT_FOUND`         | Recurso o ruta inexistente                                                               |
| 409  | `CONFLICT`          | Choca con el estado actual (ej: transición de pedido inválida)                           |
| 429  | `TOO_MANY_REQUESTS` | Demasiados intentos (rate limit de login y registro)                                     |
| 500  | `INTERNAL`          | Error inesperado. Mostrar mensaje genérico; el `traceId` sirve para buscarlo en los logs |

Schema: `apiErrorSchema`.

---

## Catálogo (público, sin login)

### `GET /api/menu`

Todo lo que necesita la página del menú en un solo request. Cacheado 30 s en el server.

Schema: `menuResponseSchema` · Tipo: `MenuResponse`

```json
{
  "store": {
    "isOpen": true,
    "deliveryFee": 2500,
    "minOrderDelivery": 12000,
    "freeDeliveryThreshold": 35000,
    "etaMin": 30,
    "etaMax": 45
  },
  "categories": [
    {
      "id": "uuid",
      "slug": "hamburguesas",
      "name": "Hamburguesas",
      "products": [
        {
          "id": "uuid",
          "slug": "clasica",
          "name": "Clásica",
          "description": "Medallón smash de 110 g, cheddar, pepinos...",
          "basePrice": 10900,
          "imageUrl": null,
          "type": "simple",
          "badges": ["popular"],
          "isAvailable": true,
          "hasRequiredModifiers": true
        }
      ]
    }
  ]
}
```

Notas para la UI:

- **Categorías** ya vienen ordenadas y solo las que tienen productos: sirven directo para la nav
  sticky (`slug` como id de ancla).
- **`isAvailable: false`** = agotado temporalmente. Mostrar la card deshabilitada con el texto
  "Agotado" (no solo gris).
- **`hasRequiredModifiers`**: si es `true`, el botón "+" abre el personalizador (con los
  modificadores `isDefault` ya marcados) en vez de agregar directo. Hoy es `true` para
  hamburguesas, combos, papas y gaseosa.
- **`imageUrl`** puede ser `null` hasta que se carguen fotos desde el admin (Fase 6): usar un
  placeholder.
- **`badges`**: `nuevo` | `picante` | `veggie` | `sin_tacc` | `popular`.
- **`store`**: para el header ("30-45 min", "Envío $ 2.500", "Envío gratis desde $ 35.000"), el
  aviso de mínimo y "Cerrado" si `isOpen` es `false`.

### `GET /api/products/:slug`

Detalle para el personalizador. `slug` debe matchear `^[a-z0-9]+(-[a-z0-9]+)*$`; si no, 400.
Producto inexistente o dado de baja: 404.

Schema: `productDetailSchema` · Tipo: `ProductDetail` (= `ProductSummary` + campos de abajo)

```json
{
  "id": "uuid",
  "slug": "combo-clasica",
  "name": "Combo Clásica",
  "basePrice": 15900,
  "type": "combo",
  "categorySlug": "combos",
  "...": "resto de ProductSummary",
  "modifierGroups": [
    {
      "id": "uuid",
      "code": "acomp_combo",
      "name": "Elegí tu acompañamiento",
      "description": "",
      "minSelect": 1,
      "maxSelect": 1,
      "isRequired": true,
      "modifiers": [
        {
          "id": "uuid",
          "name": "Papas clásicas",
          "priceDelta": 0,
          "maxQuantity": 1,
          "isDefault": true,
          "isAvailable": true
        },
        {
          "id": "uuid",
          "name": "Aros de cebolla",
          "priceDelta": 1500,
          "maxQuantity": 1,
          "isDefault": false,
          "isAvailable": true
        }
      ]
    }
  ]
}
```

Cómo renderizar cada grupo:

| Caso                                | Control sugerido                          | Etiqueta                |
| ----------------------------------- | ----------------------------------------- | ----------------------- |
| `minSelect = 1`, `maxSelect = 1`    | Radio buttons                             | "Obligatorio · Elegí 1" |
| `minSelect = 0`, `maxSelect > 1`    | Checkboxes (deshabilitar al llegar a max) | "Opcional · Hasta N"    |
| `maxQuantity > 1` en un modificador | Stepper −/+ (ej: "Cheddar extra x2")      | —                       |
| `priceDelta > 0`                    | Mostrar "+ $ 1.500" al lado               | —                       |

- Grupos y modificadores ya vienen ordenados.
- Precio en vivo: `(basePrice + Σ priceDelta × cantidad) × cantidadDelProducto`. Es solo para
  mostrar: **el server recalcula todo** al crear el pedido (Fase 5) y nunca confía en el precio
  que mande el front.
- CTA deshabilitado hasta cumplir todos los `minSelect`.

---

## Auth

Auth propia con JWT. El **access token** (15 min) va en el body y el front lo guarda **en
memoria** (nunca en localStorage). El **refresh token** (7 días) va en una cookie httpOnly `rt`
con path `/api/auth`: JS no la puede leer y el navegador la manda sola. Por eso los requests a
`/api/auth/*` van con `credentials: 'include'`.

Schemas: `registerSchema`, `loginSchema`, `authResponseSchema`, `authUserSchema`.

| Método y ruta             | Body                                | Respuesta                                      |
| ------------------------- | ----------------------------------- | ---------------------------------------------- |
| `POST /api/auth/register` | `{ email, password, name, phone? }` | `201` + `AuthResponse` + cookie `rt`           |
| `POST /api/auth/login`    | `{ email, password }`               | `200` + `AuthResponse` + cookie `rt`           |
| `POST /api/auth/refresh`  | (nada, usa la cookie)               | `200` + `AuthResponse` + cookie `rt` **nueva** |
| `POST /api/auth/logout`   | (nada, usa la cookie)               | `204` y borra la cookie                        |
| `GET /api/auth/me`        | Header `Authorization: Bearer <t>`  | `200` + `AuthUser`                             |

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "ana@mail.com",
    "name": "Ana",
    "phone": null,
    "role": "customer"
  }
}
```

Reglas:

- **Validación:** el email se normaliza (minúsculas, sin espacios). La contraseña tiene de 8 a
  72 caracteres. Errores de validación: `400` con `details` por campo.
- **Rol:** el registro **siempre** crea `customer`, aunque el body traiga `role`. Los admins se
  crean con `npm run create-admin -w server -- --email <email> --name "<nombre>"`, que pide la
  contraseña oculta.
- **Errores:**
  - Email duplicado en el registro: `409`.
  - Login incorrecto: `401` con un mensaje único ("Email o contraseña incorrectos"), exista o no
    el email.
  - Rate limit: `429 TOO_MANY_REQUESTS` después de **10 intentos fallidos cada 15 min por IP**
    (registro y login comparten el cupo; los logins correctos no cuentan). El refresh tiene 60
    cada 15 min.
- **Rotación del refresh:**
  - Cada `refresh` invalida el token usado y entrega uno nuevo.
  - Si llega un token ya usado (posible robo), se revoca **toda la sesión** y hay que volver a
    loguearse.
  - No llames a `refresh` en paralelo desde dos lugares: compartí una sola Promise en vuelo.
- **Rutas protegidas:** sin token o con token inválido o vencido dan `401`. Con un rol que no
  corresponde (cliente en `/api/admin/*`) dan `403`.

Flujo recomendado en el front:

1. **Al cargar la app:** `POST /api/auth/refresh`. Si da `200`, la sesión está activa y el access
   token queda en memoria. Si da `401`, el usuario es invitado.
2. **Requests protegidos:** van con `Authorization: Bearer <accessToken>`.
3. **Ante un `401`:** un `refresh` y reintentar el request una vez. Si el refresh también falla,
   mandar al login.
4. **Login:** se pide recién al confirmar el pedido. Mientras tanto se navega y se arma el carrito
   como invitado.

### Admin

Todo `/api/admin/*` exige un token de un usuario con rol `admin`. Por ahora hay solo
`GET /api/admin/ping`; el resto llega en la Fase 6.

---

## Pedidos

**El back recalcula todo** desde la DB: precios, modificadores, envío, cupón y total. Del front
solo se usan ids, cantidades, selecciones, dirección, contacto y pago. Si mandás un precio, se
ignora. El usuario sale del token, nunca del body.

Schemas: `quoteRequestSchema`, `quoteResponseSchema`, `createOrderSchema`, `orderDetailSchema`,
`orderSummarySchema`. Helpers en `@burger/shared`: `computeOrderTotals`, `luhnCheck`,
`detectCardBrand`, `isExpiryValid`, `nextStatusesFor`, `ORDER_TRANSITIONS`.

| Método y ruta                        | Auth          | Qué hace                                                          |
| ------------------------------------ | ------------- | ----------------------------------------------------------------- |
| `POST /api/orders/quote`             | No (invitado) | Resumen del checkout: subtotal, envío, cupón, total. No crea nada |
| `POST /api/orders`                   | Sí            | Crea el pedido. `201` + `OrderDetail`                             |
| `GET /api/orders/mine`               | Sí            | `OrderSummary[]` (más nuevos primero, hasta 50)                   |
| `GET /api/orders/:id`                | Sí (dueño)    | `OrderDetail` con ítems, modificadores e historial                |
| `POST /api/orders/:id/cancel`        | Sí (dueño)    | Solo en `pending` o `confirmed`. Devuelve el `OrderDetail`        |
| `PATCH /api/admin/orders/:id/status` | Admin         | `{ status, note? }`. Valida contra el mapa de transiciones        |
| `GET /api/admin/orders/:id`          | Admin         | Igual que el detalle, con `nextStatuses` para los botones         |

### `POST /api/orders/quote` (y base de `POST /api/orders`)

```json
{
  "fulfillment": "delivery",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "selections": [{ "modifierId": "uuid", "quantity": 1 }],
      "notes": "sin sal"
    }
  ],
  "couponCode": "BIENVENIDA10"
}
```

Respuesta:

```json
{
  "lines": [
    {
      "productId": "uuid",
      "productName": "Combo Clásica",
      "quantity": 2,
      "unitPrice": 18300,
      "itemTotal": 36600
    }
  ],
  "subtotal": 36600,
  "deliveryFee": 0,
  "discount": 3660,
  "total": 32940,
  "missingForMinimum": 0,
  "missingForFreeDelivery": null,
  "coupon": { "code": "BIENVENIDA10", "discount": 3660 },
  "couponError": null,
  "storeOpen": true
}
```

- **`couponError`:** el cupón no aplica (no existe, venció, sin usos o no llega al mínimo) y trae
  el mensaje para mostrar. La cotización **no falla** por el cupón.
- **`missingForMinimum` > 0:** delivery debajo del mínimo. Mostrá "Te faltan $X" y deshabilitá
  confirmar.
- **`missingForFreeDelivery`:** para la barra "Te faltan $X para envío gratis".
- **Selección inválida o producto agotado:** `400` con un mensaje listo para mostrar (ej.
  "Combo Clásica: Elegí 1") y `details.itemIndex` para marcar la línea del carrito.

### `POST /api/orders`

Body = el de la cotización +:

```json
{
  "contact": { "name": "Ana", "phone": "11 4444-5555" },
  "address": {
    "street": "Av. Corrientes",
    "number": "1234",
    "apt": "3B",
    "betweenStreets": "Uruguay y Paraná",
    "notes": "timbre 3"
  },
  "payment": {
    "method": "card",
    "cardNumber": "4242 4242 4242 4242",
    "holderName": "ANA",
    "expMonth": 12,
    "expYear": 30,
    "cvv": "123"
  },
  "notes": "opcional"
}
```

- **`address`:** obligatoria si es `delivery`. En `pickup` se ignora.
- **Pago en efectivo:** `{ "method": "cash", "cashAmount": 20000 }`. `cashAmount` ("¿con cuánto
  pagás?") es opcional; si viene, tiene que cubrir el total.
- **Tarjeta simulada:** Luhn, marca por prefijo, vencimiento MM/AA a futuro y CVV de 3 dígitos (4
  en Amex). Se guardan solo `paymentBrand` y `paymentLast4`.

| Tarjeta de prueba     | Resultado                             |
| --------------------- | ------------------------------------- |
| `4242 4242 4242 4242` | Aprobada (Visa)                       |
| `5555 5555 5555 4444` | Aprobada (Mastercard)                 |
| `3782 822463 10005`   | Aprobada (Amex, CVV de 4)             |
| `4000 0000 0000 0002` | **Rechazada**: `402 PAYMENT_DECLINED` |

Errores específicos:

| HTTP | Cuándo                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 400  | Validación, selección inválida, tarjeta inválida o vencida, efectivo insuficiente, cupón que no aplica, debajo del mínimo |
| 401  | Sin login: es el momento de pedir login (se navega como invitado hasta acá)                                               |
| 402  | Tarjeta rechazada (simulado)                                                                                              |
| 409  | Local cerrado, o el cupón se agotó entre la cotización y la confirmación                                                  |
| 429  | Más de 10 pedidos en 15 min por usuario                                                                                   |

### Estados y seguimiento del pedido

```
pending -> confirmed -> preparing -> on_the_way       -> delivered   (delivery)
                                  -> ready_for_pickup -> delivered   (retiro)
pending -> rejected (admin)    pending | confirmed -> cancelled (cliente o admin)
```

- **`history`:** `[{ status, changedAt, note }]` en orden, para el timeline del seguimiento.
- **`canCancel`:** `true` si sos el dueño y está en `pending` o `confirmed`.
- **`nextStatuses`:** solo con un usuario admin. Son los botones de "siguiente estado".
- **Seguimiento:** polling de `GET /api/orders/:id` cada ~10 s mientras no esté en `delivered`,
  `cancelled` o `rejected`.
- **Transición inválida o cambio concurrente:** `409`.

Etiquetas sugeridas: `pending` "Recibido", `confirmed` "Confirmado", `preparing` "En
preparación", `on_the_way` "En camino", `ready_for_pickup` "Listo para retirar", `delivered`
"Entregado", `cancelled` "Cancelado", `rejected` "Rechazado".

---

## Health

### `GET /api/health`

`200` si todo anda, `503` si el server está vivo pero la DB no responde. Schema:
`healthResponseSchema`.

---

## Próximas fases

- **Fase 6 — Admin:** listado de pedidos con filtros, CRUD de productos, categorías y modificadores, subida de imágenes, abrir o cerrar el local, auto-avance de estados y dashboard.
