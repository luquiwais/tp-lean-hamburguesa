import { categorySchema, productSchema, storeSettingsSchema } from '@burger/shared';
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

// ponytail: catálogo mock hasta que el back sirva /categories, /products y /store (Fase 2).
// Contra el back real: VITE_USE_MOCKS=false npm run dev. Cuando esté listo, borrar src/mocks/.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

async function catalog<T>(path: string, schema: Parser<T>, mockData: unknown): Promise<T> {
  return USE_MOCKS ? schema.parse(mockData) : get(path, schema);
}

export const api = {
  categories: () => catalog('/categories', categorySchema.array(), mock.categories),
  products: () => catalog('/products', productSchema.array(), mock.products),
  store: () => catalog('/store', storeSettingsSchema, mock.store),
};
