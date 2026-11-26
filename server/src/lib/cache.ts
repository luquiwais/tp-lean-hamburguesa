// Cache en memoria con TTL y coalescing de requests en vuelo.
//
// getOrFetch(key, fetchFn): si hay un valor vigente lo devuelve; si no,
// ejecuta fetchFn UNA sola vez aunque lleguen muchos requests a la vez
// (todos comparten la misma Promise). Si fetchFn falla y hay un valor
// vencido, se sirve ese valor (fallback "ultimo dato conocido").

interface Entry<T> {
  value: T;
  expiresAt: number;
}

// maxEntries acota la memoria: las claves pueden derivar de input del
// usuario (ej: slug), asi que nunca se cachean resultados null/undefined
// y al superar el limite se descarta la entrada mas vieja.
export function createCache(defaultTtlMs: number, maxEntries = 500) {
  const store = new Map<string, Entry<unknown>>();
  const inFlight = new Map<string, Promise<unknown>>();

  async function getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs = defaultTtlMs,
  ): Promise<T> {
    const cached = store.get(key) as Entry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = inFlight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = fetchFn()
      .then((value) => {
        if (value !== null && value !== undefined) {
          store.delete(key); // reinsertar al final (orden de insercion = antiguedad)
          store.set(key, { value, expiresAt: Date.now() + ttlMs });
          if (store.size > maxEntries) {
            const oldest = store.keys().next().value;
            if (oldest !== undefined) store.delete(oldest);
          }
        }
        return value;
      })
      .catch((err: unknown) => {
        if (cached) return cached.value; // stale fallback
        throw err;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  }

  function invalidate(prefix = ''): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  return { getOrFetch, invalidate };
}

// Cache del catalogo publico. El admin lo invalida al editar el menu (Fase 6).
export const catalogCache = createCache(30_000);
