import { useMemo } from 'react';
import { Link, Outlet } from 'react-router';
import { Hamburger } from 'lucide-react';
import type { MenuResponse } from '@burger/shared';
import { Button } from '@/components/ui/button';
import { CartBar } from '@/features/cart/CartBar';
import { useCartSummary } from '@/features/cart/useCartSummary';
import { CategoryNav } from './CategoryNav';
import { ProductCard } from './ProductCard';
import { StoreHero } from './StoreHero';
import { useMenu } from './queries';

// Página principal. El personalizador (/menu/:slug) y el carrito (/carrito)
// se renderizan en el <Outlet /> como overlays encima del menú.
export function MenuPage() {
  const menu = useMenu();
  const { count } = useCartSummary();

  let content;
  if (menu.data) {
    content = <Menu menu={menu.data} />;
  } else if (menu.isError) {
    content = (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <p className="text-lg font-semibold">No pudimos cargar el menú.</p>
        <p className="text-ink-muted">Revisá tu conexión y probá de nuevo.</p>
        <Button className="rounded-full" onClick={() => void menu.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  } else {
    content = <MenuSkeleton />;
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-12">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-white">
              <Hamburger className="size-4" aria-hidden />
            </span>
            Hamburguesería
          </Link>
        </div>
      </header>
      {content}
      <p className="sr-only" aria-live="polite">
        {count > 0 ? `Tu pedido tiene ${count} ${count === 1 ? 'producto' : 'productos'}` : ''}
      </p>
      <CartBar />
      <Outlet />
    </div>
  );
}

// Las categorías ya vienen ordenadas, con sus productos y sin vacías (GET /api/menu).
function Menu({ menu }: { menu: MenuResponse }) {
  const popular = useMemo(
    () => menu.categories.flatMap((c) => c.products).filter((p) => p.badges.includes('popular')),
    [menu],
  );
  const sections = useMemo(
    () => menu.categories.map((c) => ({ id: c.slug, title: c.name, items: c.products })),
    [menu],
  );
  const navSections = useMemo(
    () => [
      ...(popular.length > 0 ? [{ id: 'mas-pedidos', title: 'Más pedidos' }] : []),
      ...sections.map(({ id, title }) => ({ id, title })),
    ],
    [popular, sections],
  );

  return (
    <>
      <StoreHero store={menu.store} imageUrl={popular[0]?.imageUrl ?? null} />
      <CategoryNav sections={navSections} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        {popular.length > 0 && (
          <section
            id="mas-pedidos"
            aria-labelledby="mas-pedidos-title"
            className="scroll-mt-16 pt-8"
          >
            <h2 id="mas-pedidos-title" className="mb-4 text-2xl font-bold">
              Más pedidos
            </h2>
            <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:px-0">
              {popular.map((p) => (
                <li key={p.id} className="w-56 shrink-0 snap-start lg:w-auto">
                  <ProductCard product={p} stacked />
                </li>
              ))}
            </ul>
          </section>
        )}
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-title`}
            className="scroll-mt-16 pt-10"
          >
            <h2 id={`${s.id}-title`} className="mb-4 text-2xl font-bold">
              {s.title}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {s.items.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}

function MenuSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el menú">
      <div className="h-72 animate-pulse bg-bone" />
      <div className="mx-auto grid max-w-6xl gap-3 px-4 pt-10 sm:px-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-bone md:h-72" />
        ))}
      </div>
    </div>
  );
}
