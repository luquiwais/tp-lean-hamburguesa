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

| HTTP | `code`         | Cuándo                                                                                   |
| ---- | -------------- | ---------------------------------------------------------------------------------------- |
| 400  | `BAD_REQUEST`  | Input inválido. `details` trae los errores por campo                                     |
| 401  | `UNAUTHORIZED` | Falta login o token vencido (Fase 3)                                                     |
| 403  | `FORBIDDEN`    | Logueado pero sin permiso (ej: cliente en ruta admin)                                    |
| 404  | `NOT_FOUND`    | Recurso o ruta inexistente                                                               |
| 409  | `CONFLICT`     | Choca con el estado actual (ej: transición de pedido inválida)                           |
| 500  | `INTERNAL`     | Error inesperado. Mostrar mensaje genérico; el `traceId` sirve para buscarlo en los logs |

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

## Health

### `GET /api/health`

`200` si todo anda, `503` si el server está vivo pero la DB no responde. Schema:
`healthResponseSchema`.

---

## Próximas fases

- **Fase 3 — Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`,
  `POST /api/auth/logout`, `GET /api/auth/me`. El access token viaja en
  `Authorization: Bearer <token>` y se guarda **en memoria** (no localStorage); el refresh token
  va en una cookie httpOnly que maneja el navegador solo (usar `credentials: 'include'`).
- **Fase 5 — Pedidos:** `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/:id`,
  `POST /api/orders/:id/cancel`.
- **Fase 7 — Cupones:** `POST /api/coupons/validate`.
