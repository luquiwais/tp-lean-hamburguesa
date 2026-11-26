import { useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { CartButton } from '@/features/cart/CartBar';

type Section = { id: string; title: string };

// Distancia desde el borde superior a partir de la cual una sección cuenta
// como "activa" (alto de esta barra sticky + un margen).
const SPY_OFFSET = 96;

// Barra sticky de categorías con scroll-spy: resalta la sección que se está
// viendo y al tocar un chip scrollea hasta ella.
export function CategoryNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
      let current = sections[0]?.id;
      for (const { id } of sections) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && (top <= SPY_OFFSET || atBottom)) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  // Mantiene el chip activo centrado dentro de la barra (scroll horizontal).
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (list && chip) {
      list.scrollTo({
        left: chip.offsetLeft - (list.clientWidth - chip.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [active]);

  return (
    <nav
      aria-label="Categorías del menú"
      className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-6">
        <ul ref={listRef} className="no-scrollbar relative flex flex-1 gap-2 overflow-x-auto py-3">
          {sections.map(({ id, title }) => (
            <li key={id} data-id={id} className="shrink-0">
              <button
                type="button"
                aria-current={active === id ? 'true' : undefined}
                onClick={() => document.getElementById(id)?.scrollIntoView({ block: 'start' })}
                className={cn(
                  'h-9 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
                  active === id ? 'bg-ink text-white' : 'bg-bone text-ink hover:bg-line',
                )}
              >
                {title}
              </button>
            </li>
          ))}
        </ul>
        <CartButton />
      </div>
    </nav>
  );
}
