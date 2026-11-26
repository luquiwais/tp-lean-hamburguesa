import { Link } from 'react-router';
import { LoaderCircle, ShoppingBag } from 'lucide-react';
import { MAX_ITEM_QUANTITY } from '@burger/shared';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatARS } from '@/lib/format';
import { useCloseOverlay } from '@/lib/useCloseOverlay';
import { useMenu } from '@/features/menu/queries';
import { useCart } from './store';
import { useCartSummary } from './useCartSummary';

// Ruta /carrito: drawer a la derecha en desktop, pantalla completa en mobile.
export function CartSheet() {
  const close = useCloseOverlay();
  const { lines, count, subtotal, hasInvalid, ready } = useCartSummary();
  const store = useMenu().data?.store;
  const missing = store ? store.minOrderDelivery - subtotal : 0;

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-line">
          <SheetTitle className="font-display text-xl font-bold">Tu pedido</SheetTitle>
          <SheetDescription>
            {count === 0
              ? 'Todavía no agregaste nada.'
              : `${count} ${count === 1 ? 'producto' : 'productos'}`}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-bone">
              <ShoppingBag className="size-7 text-ink-muted" aria-hidden />
            </span>
            <p className="text-ink-muted">Elegí algo del menú y aparece acá.</p>
            <Button className="rounded-full" onClick={close}>
              Ver el menú
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex flex-1 justify-center pt-16 text-ink-muted" role="status">
            <LoaderCircle className="size-6 animate-spin" aria-hidden />
            <span className="sr-only">Cargando tu pedido…</span>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-4">
              {lines.map((line) => (
                <CartLine key={line.item.id} line={line} />
              ))}
            </ul>
            <SheetFooter className="gap-3 border-t border-line">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatARS(subtotal)}</span>
              </div>
              {store && (
                <p className="text-sm text-ink-muted">
                  Envío {formatARS(store.deliveryFee)} si es delivery. Retiro en el local sin cargo.
                </p>
              )}
              {missing > 0 && (
                <p className="rounded-xl bg-bone px-3 py-2 text-sm">
                  Te faltan <strong className="tabular-nums">{formatARS(missing)}</strong> para el
                  mínimo de delivery. Para retirar no hay mínimo.
                </p>
              )}
              {hasInvalid && (
                <p className="text-sm font-medium text-accent-700">
                  Revisá los productos marcados antes de seguir.
                </p>
              )}
              <Button size="lg" disabled className="h-12 rounded-full text-base">
                Ir a pagar
              </Button>
              <p className="text-center text-xs text-ink-muted">El checkout llega en la Fase 5.</p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type Line = ReturnType<typeof useCartSummary>['lines'][number];

function CartLine({ line }: { line: Line }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const { item, product, summary, total, valid } = line;

  return (
    <li className="flex gap-3 py-4">
      <div className="size-16 shrink-0 overflow-hidden rounded-xl">
        <ProductImage src={product?.imageUrl ?? null} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{product?.name ?? 'Producto que ya no está en el menú'}</p>
          {valid && <p className="font-semibold tabular-nums">{formatARS(total)}</p>}
        </div>
        {summary && <p className="text-sm text-ink-muted">{summary}</p>}
        {item.notes && <p className="text-sm text-ink-muted">“{item.notes}”</p>}
        {!valid && (
          <p className="text-sm font-medium text-accent-700">
            {product ? 'Cambió o se agotó: editalo o sacalo.' : 'Sacalo para poder seguir.'}
          </p>
        )}
        <div className="mt-1 flex items-center gap-4">
          {product && (
            <>
              <QuantityStepper
                value={item.quantity}
                onChange={(n) => setQuantity(item.id, n)}
                min={1}
                max={MAX_ITEM_QUANTITY}
                label={`una unidad de ${product.name}`}
              />
              <Link
                to={`/menu/${product.slug}?edit=${item.id}`}
                className="text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
              >
                Editar
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => remove(item.id)}
            className="text-sm text-ink-muted underline-offset-4 hover:text-accent-700 hover:underline"
          >
            Eliminar
          </button>
        </div>
      </div>
    </li>
  );
}
