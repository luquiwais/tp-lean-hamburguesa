import { Link, useLocation } from 'react-router';
import { ShoppingBag } from 'lucide-react';
import { formatARS } from '@/lib/format';
import { useCartSummary } from './useCartSummary';

// Mobile: barra fija "Ver pedido (3) · $X" abajo, solo en el menú y con algo cargado.
export function CartBar() {
  const { count, subtotal, ready } = useCartSummary();
  const { pathname } = useLocation();
  if (!ready || count === 0 || pathname !== '/') return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <Link
        to="/carrito"
        className="flex h-14 items-center justify-between rounded-full bg-brand-600 px-5 font-semibold text-white shadow-lg transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <span>
          Ver pedido{' '}
          <span key={count} className="inline-block animate-bump">
            ({count})
          </span>
        </span>
        <span className="tabular-nums">{formatARS(subtotal)}</span>
      </Link>
    </div>
  );
}

// Desktop: botón del pedido dentro de la barra sticky de categorías.
export function CartButton() {
  const { count, subtotal, ready } = useCartSummary();

  return (
    <Link
      to="/carrito"
      className="hidden h-10 shrink-0 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:inline-flex"
    >
      <ShoppingBag className="size-4" aria-hidden />
      Tu pedido
      {ready && count > 0 && (
        <>
          <span key={count} className="animate-bump rounded-full bg-white/20 px-2 tabular-nums">
            {count}
          </span>
          <span className="tabular-nums">{formatARS(subtotal)}</span>
        </>
      )}
    </Link>
  );
}
