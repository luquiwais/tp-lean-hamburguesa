import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { defaultSelections } from '@burger/shared';
import type { Product } from '@/lib/catalogContract';
import { BadgePill } from '@/components/BadgePill';
import { ProductImage } from '@/components/ProductImage';
import { formatARS } from '@/lib/format';
import { useCart } from '@/features/cart/store';

type Props = {
  product: Product;
  /** Siempre foto arriba (carrusel "Más pedidos"). */
  stacked?: boolean;
};

// Mobile: fila con la foto a la derecha. Desktop (md+): tarjeta con foto arriba.
// Toda la tarjeta abre el personalizador (link estirado); el "+" agrega directo
// solo si el producto no tiene grupos obligatorios.
export function ProductCard({ product, stacked = false }: Props) {
  const add = useCart((s) => s.add);
  const quickAdd = product.isAvailable && product.modifierGroups.every((g) => g.minSelect === 0);

  return (
    <article
      className={cn(
        'group relative flex h-full gap-4 rounded-card border border-line bg-white p-3 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-600',
        stacked ? 'flex-col' : 'md:flex-col',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base leading-snug font-semibold">
          <Link
            to={`/menu/${product.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-card"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-ink-muted">{product.description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <span className="font-semibold tabular-nums">{formatARS(product.basePrice)}</span>
          {product.badges.map((badge) => (
            <BadgePill key={badge} badge={badge} />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-xl',
          stacked
            ? 'order-first aspect-[4/3] w-full'
            : 'size-28 md:order-first md:aspect-[4/3] md:size-auto md:w-full',
        )}
      >
        <ProductImage
          src={product.imageUrl}
          className={cn(
            'transition-transform duration-300 group-hover:scale-105',
            !product.isAvailable && 'grayscale',
          )}
        />
        {!product.isAvailable && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-1 text-center text-xs font-semibold text-white">
            Agotado
          </span>
        )}
        {quickAdd && (
          <button
            type="button"
            onClick={() =>
              add({
                productId: product.id,
                quantity: 1,
                selections: defaultSelections(product),
                notes: '',
              })
            }
            className="absolute right-2 bottom-2 z-10 grid size-10 place-items-center rounded-full bg-white text-ink shadow-md ring-1 ring-line transition-colors hover:bg-brand-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-95"
            aria-label={`Agregar ${product.name} al pedido`}
          >
            <Plus className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}
