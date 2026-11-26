import type { ReactNode } from 'react';
import { Bike, Clock, ShoppingBag, Sparkles } from 'lucide-react';
import { cn } from 'cn';
import type { StoreInfo } from '@burger/shared';
import { formatARS } from '@/lib/format';

type Props = { store: StoreInfo; imageUrl: string | null };

// Header del local: estado, demora, envío y mínimo visibles antes de elegir nada
// (sin sorpresas de precio al final).
export function StoreHero({ store, imageUrl }: Props) {
  const status = store.isOpen ? 'Abierto ahora' : 'Cerrado ahora';

  return (
    <section className="bg-bone">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.15fr_1fr] md:items-center md:py-14">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold tracking-widest text-brand-600 uppercase">
            Delivery y retiro en el local
          </p>
          <h1 className="text-4xl font-bold text-balance sm:text-5xl">
            Hamburguesas hechas al momento
          </h1>
          <p className="max-w-prose text-lg text-ink-muted">
            Carne de pastura, pan de papa y nada de vueltas. Pedí para delivery o pasá a retirar.
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <Chip>
              <span
                className={cn(
                  'size-2 rounded-full',
                  store.isOpen ? 'bg-brand-500' : 'bg-accent-600',
                )}
                aria-hidden
              />
              {status}
            </Chip>
            <Chip>
              <Clock className="size-4" aria-hidden />
              {store.etaMin}–{store.etaMax} min
            </Chip>
            <Chip>
              <Bike className="size-4" aria-hidden />
              Envío {formatARS(store.deliveryFee)}
            </Chip>
            <Chip>
              <ShoppingBag className="size-4" aria-hidden />
              Mínimo {formatARS(store.minOrderDelivery)}
            </Chip>
            {store.freeDeliveryThreshold !== null && (
              <Chip>
                <Sparkles className="size-4" aria-hidden />
                Envío gratis desde {formatARS(store.freeDeliveryThreshold)}
              </Chip>
            )}
          </ul>
        </div>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="hidden aspect-[4/3] w-full rounded-card object-cover shadow-sm md:block"
          />
        )}
      </div>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 font-medium">
      {children}
    </li>
  );
}
