import { useEffect, useState } from 'react';
import { healthResponseSchema, type HealthResponse } from '@burger/shared';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

// Pantalla placeholder de la Fase 0: muestra los tokens de diseno y verifica
// que el client llega al server y valida la respuesta con el schema compartido.
export default function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        // 503 = server vivo pero DB caida: igual trae el cuerpo con el detalle
        if (!res.ok && res.status !== 503) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => setApi({ kind: 'ok', data: healthResponseSchema.parse(json) }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setApi({ kind: 'error', message: err instanceof Error ? err.message : 'Error' });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-dvh bg-bone">
      <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Fase 0 · Scaffolding
          </p>
          <h1 className="text-4xl font-bold sm:text-5xl">Hamburguesas hechas al momento</h1>
          <p className="max-w-prose text-lg text-ink-muted">
            Carne de pastura, pan de papa y nada de vueltas. Pedí para delivery o pasá a retirar.
          </p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 rounded-full bg-brand-600 px-6 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Ver menú
          </button>
          <button
            type="button"
            className="min-h-11 rounded-full border border-line bg-white px-6 font-semibold text-ink transition-colors hover:bg-bone"
          >
            Retiro en el local
          </button>
          <span className="inline-flex min-h-11 items-center rounded-full bg-accent-600 px-4 text-sm font-semibold text-white">
            Nuevo
          </span>
        </div>

        <div className="rounded-card border border-line bg-white p-5" aria-live="polite">
          <h2 className="mb-2 text-lg font-semibold">Estado de la API</h2>
          {api.kind === 'loading' && <p className="text-ink-muted">Conectando con el server...</p>}
          {api.kind === 'ok' && (
            <div className="flex flex-col gap-1">
              <p className="text-brand-700">
                Conectado a <strong>{api.data.service}</strong> · uptime {api.data.uptimeSeconds}s
              </p>
              <p className={api.data.database === 'ok' ? 'text-brand-700' : 'text-accent-700'}>
                Base de datos: {api.data.database === 'ok' ? 'conectada' : 'sin conexión'}
              </p>
            </div>
          )}
          {api.kind === 'error' && (
            <p className="text-accent-700">No se pudo conectar ({api.message}).</p>
          )}
        </div>
      </section>
    </main>
  );
}
