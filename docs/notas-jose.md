# Notas para José (front) — 26/11

## Qué pasó

Tu commit de la Fase 4 (`1ea46a2`) y el de la Fase 2 del back (`fase 2 terminada`) definían
**dos contratos distintos** para el catálogo y chocaron en `shared/src/schemas/catalog.ts`.

**Decisión:** queda el contrato del back. Ya está implementado, testeado contra la DB real y
documentado en [`docs/api.md`](api.md).

|                | Antes (tu mock)                                              | Ahora (oficial)                                                                             |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Endpoints      | `GET /api/categories`, `GET /api/products`, `GET /api/store` | `GET /api/menu` y `GET /api/products/:slug`                                                 |
| Menú           | 3 requests, productos completos con grupos                   | **1 request**: `store` + categorías con sus productos ya agrupados y resumidos (sin grupos) |
| Personalizador | Producto sacado de la lista                                  | `GET /api/products/:slug` trae el detalle con grupos y modificadores                        |

## Qué toqué en tu código (sin cambiar lógica)

Todo sigue andando con los mocks y pasa typecheck, lint, tests y build.

- **`shared/src/schemas/catalog.ts`:** ahora tiene los schemas del back (`menuResponseSchema`,
  `productDetailSchema`, `ProductSummary`, `ModifierGroup`, `StoreInfo`...).
- **`client/src/lib/catalogContract.ts`** (nuevo, **TEMPORAL**): tu contrato original (`Category`,
  `Product`, `StoreSettings`, `ProductInput` y sus schemas), copiado tal cual, para que tus
  componentes y mocks compilen mientras migrás.
- **Imports:** cambié el import de esos tipos en 6 archivos, de `@burger/shared` a
  `@/lib/catalogContract`: `MenuPage`, `StoreHero`, `ProductCard`, `ProductCustomizer`,
  `lib/api.ts` y `mocks/catalog.ts`.
- **`shared/src/pricing.ts`:** **se queda tu lógica**. Solo cambié el tipo del parámetro: en vez de
  tu `Product` recibe una interfaz mínima, `PricedProduct` (`basePrice` + `modifierGroups`).
  Funciona igual con tu `Product` viejo y con el `ProductDetail` nuevo, y el back la va a usar en
  el `POST /orders` para recalcular precios.
- **`shared/src/pricing.test.ts`:** el ejemplo ahora es un objeto `PricedProduct` en vez de
  pasarlo por `productSchema`. Los 6 tests dan igual.
- **`client/package.json`:** sumé `zod` como dependencia directa, porque `catalogContract.ts` lo
  importa.

## Migración a la API real (lo que te queda)

### 1. `lib/api.ts` y `features/menu/queries.ts`

```ts
// lib/api.ts
import { menuResponseSchema, productDetailSchema } from '@burger/shared';

export const api = {
  menu: () => get('/menu', menuResponseSchema),
  product: (slug: string) => get(`/products/${encodeURIComponent(slug)}`, productDetailSchema),
};

// queries.ts
export const useMenu = () => useQuery({ queryKey: ['menu'], queryFn: api.menu });
export const useProduct = (slug: string) =>
  useQuery({ queryKey: ['product', slug], queryFn: () => api.product(slug) });
```

Tu `get()` y `ApiError` sirven tal cual: el formato de error es el de `apiErrorSchema`.

### 2. `MenuPage`

- **Datos:** un solo `useMenu()` en vez de los tres hooks.
- **Secciones:** `menu.categories` ya viene ordenado, filtrado y con los productos adentro. No hace
  falta agrupar por `categoryId`: `sections = menu.categories.map(c => ({ id: c.slug, title: c.name, items: c.products }))`.
- **"Más pedidos":** `menu.categories.flatMap(c => c.products).filter(p => p.badges.includes('popular'))`.
- **Local:** `store` sale de `menu.store`.

### 3. `ProductCard` y el botón "+"

- El producto pasa a ser `ProductSummary` y ya no trae `modifierGroups`.
- **"+":** usá `product.hasRequiredModifiers`, que calcula el back. Si es `true`, el "+" navega al
  personalizador. Si es `false`, agrega directo con `selections: []`. Hoy en el seed son `false`
  agua, limonada, aros y postres, y ninguno tiene opciones por defecto en grupos opcionales.

### 4. `ProductCustomizer`

- **Datos:** `useProduct(slug)` en vez de buscarlo en la lista. 404 = producto inexistente o dado
  de baja.
- **`ModifierGroup` nuevo:** trae además `isRequired`, `description` (ej. "Podés elegir hasta 4") y
  `code`. Mostrá `description` debajo del título del grupo.
- **Pricing:** `defaultSelections`, `validateSelections` y `unitPrice` reciben `ProductDetail`
  directo.

### 5. Carrito (`store.ts` + `useCartSummary.ts`): el cambio más importante

Hoy `useCartSummary` saca nombres y precios de `useProducts()` (todos los productos con grupos).
Con la API nueva el menú no trae grupos, así que el carrito tiene que pedir **el detalle de cada
producto que está en el carrito**:

1. **Guardar el slug:** sumá `productSlug` a `CartItem`, porque el endpoint es por slug. Subí el
   `version` del `persist` a `2` con un `migrate` que vacíe el carrito viejo (son datos de mocks).
2. **Pedir los detalles:** en `useCartSummary` usá `useQueries` con
   `queryKey: ['product', slug]` para los slugs únicos del carrito. Comparte caché con el
   personalizador, así que los productos que se acaban de agregar no hacen request de nuevo.
3. **Calcular igual que ahora:** `unitPrice` y `validateSelections` sobre esos `ProductDetail`.
   `ready` es `true` cuando todas las queries resolvieron.

El precio del front es solo para mostrar: el back lo recalcula en el pedido (Fase 5).

### 6. Limpieza

Cuando esté todo migrado: borrá `client/src/lib/catalogContract.ts`, `client/src/mocks/` y el flag
`VITE_USE_MOCKS`, y sacá la nota de mocks del README.

### Tabla de equivalencias

| Antes (`catalogContract`)      | Ahora (`@burger/shared`)                                                |
| ------------------------------ | ----------------------------------------------------------------------- |
| `Category`                     | `MenuCategory` (incluye `products`)                                     |
| `Product` en listados          | `ProductSummary` (+ `hasRequiredModifiers`, sin grupos ni `categoryId`) |
| `Product` en el personalizador | `ProductDetail` (+ `categorySlug`, `modifierGroups`)                    |
| `ModifierGroup`                | `ModifierGroup` (+ `code`, `description`, `isRequired`)                 |
| `Modifier`                     | `Modifier` (igual)                                                      |
| `StoreSettings`                | `StoreInfo` (por ahora sin `closesAt`)                                  |

## Diferencias con tus mocks

- **Slugs de categorías:** la DB usa `papas` (nombre "Papas y más") en vez de `para-acompanar`. No
  hardcodees slugs: usá lo que venga del menú.
- **`imageUrl`:** hoy es `null` en todos los productos. Las fotos se cargan desde el admin
  (Fase 6). Tu `ProductImage` ya maneja el placeholder.
- **`closesAt`** ("Abierto hasta 23:30"): todavía **no está** en la API ni en la DB. Si lo
  necesitás, avisá y el back suma `store_settings.closes_at` + `storeInfo.closesAt`. Mientras
  tanto, "Abierto ahora".

## Lo que viene del back: auth (Fase 3, en curso)

Los endpoints están anticipados en `docs/api.md`. Para que lo vayas planificando:

- **Endpoints:** `POST /api/auth/register` y `POST /api/auth/login` devuelven
  `{ accessToken, expiresIn, user }` (`authResponseSchema`).
- **Access token:** guardalo **en memoria** (store de zustand **sin** `persist`), nunca en
  localStorage. Se manda como `Authorization: Bearer <token>`.
- **Refresh token:** va en una cookie httpOnly que maneja el navegador. Los requests a
  `/api/auth/*` tienen que ir con `credentials: 'include'`.
- **Al recargar la página:** `POST /api/auth/refresh` para recuperar la sesión (si hay cookie
  válida devuelve un access token nuevo).
- **Ante un 401** en un endpoint protegido: un `refresh` y reintentar una vez. Si el refresh
  también da 401, mandar al login.
- **Flujo:** se navega y se arma el carrito sin cuenta; el login se pide recién al confirmar el
  pedido.

## Cómo trabajamos para no pisarnos

1. **`git pull` y `npm install`** antes de arrancar, porque pueden haber cambiado las dependencias.
2. **Una rama por tarea** (`feat/front-api-real`, `feat/api-auth`) y merge a `main` con PR. No
   pushear directo a `main`.
3. **`shared/` es zona compartida.** Si necesitás cambiar un contrato, avisá antes: el back lo
   implementa y lo documenta en `docs/api.md`.
4. **Antes de pushear:** `npm run typecheck`, `npm run lint` y `npm test`.
