import { menuResponseSchema, productDetailSchema } from '@burger/shared';
import * as mock from '@/mocks/catalog';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Parser<T> = { parse: (data: unknown) => T };

// Los reintentos (3, con backoff y sin reintentar 4xx) y el dedup de GETs los
// hace TanStack Query (ver main.tsx); acá solo se hace el fetch y se valida
// la respuesta contra el schema compartido.
async function get<T>(path: string, schema: Parser<T>): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Error ${res.status}`,
    );
  }
  return schema.parse(body);
}

// ponytail: catálogo mock con el contrato oficial, para trabajar sin el back
// corriendo (necesita server/.env). Contra la API real: VITE_USE_MOCKS=false npm run dev.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

function mockProduct(slug: string) {
  const product = mock.products.find((p) => p.slug === slug);
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Producto no encontrado');
  return productDetailSchema.parse(product);
}

export const api = {
  menu: async () =>
    USE_MOCKS ? menuResponseSchema.parse(mock.menu) : get('/menu', menuResponseSchema),
  product: async (slug: string) =>
    USE_MOCKS
      ? mockProduct(slug)
      : get(`/products/${encodeURIComponent(slug)}`, productDetailSchema),
};
