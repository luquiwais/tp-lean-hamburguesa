import { useState, type Dispatch, type SetStateAction } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { Check, LoaderCircle, X } from 'lucide-react';
import { cn } from 'cn';
import {
  MAX_ITEM_QUANTITY,
  defaultSelections,
  unitPrice,
  validateSelections,
  type ModifierGroup,
  type ProductDetail,
  type Selection,
} from '@burger/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { BadgePill } from '@/components/BadgePill';
import { ProductImage } from '@/components/ProductImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatARS } from '@/lib/format';
import { useCloseOverlay } from '@/lib/useCloseOverlay';
import { useProduct } from '@/features/menu/queries';
import { useCart, type CartItem } from '@/features/cart/store';

// Ruta /menu/:slug (y /menu/:slug?edit=<línea> para editar un ítem del carrito).
export function ProductCustomizer() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { data: product, isPending } = useProduct(slug);
  const item = useCart((s) => s.items.find((i) => i.id === params.get('edit')));
  const close = useCloseOverlay();

  if (isPending) {
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-40 justify-items-center" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Cargando producto</DialogTitle>
          <LoaderCircle className="size-6 animate-spin text-ink-muted" aria-hidden />
        </DialogContent>
      </Dialog>
    );
  }
  // 404 (no existe o se dio de baja) o error: volvemos al menú.
  if (!product) return <Navigate to="/" replace />;
  const editing = item?.productId === product.id ? item : undefined;

  return (
    <Customizer
      key={`${product.id}-${editing?.id ?? 'nuevo'}`}
      product={product}
      editing={editing}
      onClose={close}
    />
  );
}

type Qty = Record<string, number>;

const toQty = (selections: Selection[]): Qty =>
  Object.fromEntries(selections.map((s) => [s.modifierId, s.quantity]));

type CustomizerProps = { product: ProductDetail; editing?: CartItem; onClose: () => void };

function Customizer({ product, editing, onClose }: CustomizerProps) {
  const add = useCart((s) => s.add);
  const update = useCart((s) => s.update);
  const [qty, setQty] = useState<Qty>(() =>
    toQty(editing?.selections ?? defaultSelections(product)),
  );
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showErrors, setShowErrors] = useState(false);

  // Solo modificadores que existen hoy en el producto, en el orden del menú.
  const selections: Selection[] = product.modifierGroups.flatMap((g) =>
    g.modifiers.flatMap((m) => {
      const quantity = qty[m.id] ?? 0;
      return quantity > 0 ? [{ modifierId: m.id, quantity }] : [];
    }),
  );
  const issues = validateSelections(product, selections);
  const total = unitPrice(product, selections) * quantity;

  function submit() {
    if (issues.length > 0) {
      setShowErrors(true);
      const groupId = issues.find((i) => i.groupId)?.groupId;
      document.getElementById(`group-${groupId}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    const next = {
      productId: product.id,
      productSlug: product.slug,
      quantity,
      selections,
      notes: notes.trim(),
    };
    if (editing) update(editing.id, next);
    else add(next);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Mobile: bottom sheet. sm+: modal centrado. */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom sm:max-h-[88dvh] sm:rounded-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto motion-safe:scroll-smooth">
          <div className="relative aspect-[16/10] bg-bone">
            <ProductImage src={product.imageUrl} alt={product.name} eager />
            <DialogClose className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-ink shadow-md transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-600">
              <X className="size-5" aria-hidden />
              <span className="sr-only">Cerrar</span>
            </DialogClose>
          </div>

          <div className="flex flex-col gap-2 px-5 pt-5 pb-4">
            <DialogTitle className="font-display text-2xl font-bold">{product.name}</DialogTitle>
            <DialogDescription className="text-base text-ink-muted">
              {product.description}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold tabular-nums">{formatARS(product.basePrice)}</span>
              {product.badges.map((badge) => (
                <BadgePill key={badge} badge={badge} />
              ))}
            </div>
          </div>

          {product.modifierGroups.map((group) => (
            <GroupField
              key={group.id}
              group={group}
              qty={qty}
              setQty={setQty}
              error={showErrors ? issues.find((i) => i.groupId === group.id)?.message : undefined}
            />
          ))}

          <div className="border-t border-line px-5 py-4">
            <label htmlFor="item-notes" className="font-semibold">
              Aclaraciones para la cocina
            </label>
            <textarea
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Ej.: la carne bien cocida"
              className="mt-2 w-full resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-white p-4">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={MAX_ITEM_QUANTITY}
            label="una unidad"
          />
          {/* aria-disabled (no disabled) para que el click lleve al grupo que falta. */}
          <Button
            size="lg"
            onClick={submit}
            disabled={!product.isAvailable}
            aria-disabled={issues.length > 0 || undefined}
            className="h-12 flex-1 rounded-full text-base aria-disabled:opacity-50"
          >
            {product.isAvailable
              ? `${editing ? 'Guardar' : 'Agregar'} ${quantity} · ${formatARS(total)}`
              : 'Agotado'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// "Obligatorio · Elegí 1" / "Opcional · Hasta 3". Si el grupo trae su propia
// descripción (cargada en el admin) va en lugar de la regla calculada.
function ruleLabel({ minSelect: min, maxSelect: max, description }: ModifierGroup) {
  const prefix = min > 0 ? 'Obligatorio' : 'Opcional';
  if (description) return `${prefix} · ${description}`;
  if (min === 0) return max === 1 ? prefix : `${prefix} · Hasta ${max}`;
  return min === max ? `${prefix} · Elegí ${min}` : `${prefix} · Elegí de ${min} a ${max}`;
}

type GroupProps = {
  group: ModifierGroup;
  qty: Qty;
  setQty: Dispatch<SetStateAction<Qty>>;
  error?: string;
};

// Un grupo de modificadores. Control según la regla: radio (obligatorio de 1),
// checkbox (el resto) o stepper (modificadores con maxQuantity > 1).
function GroupField({ group, qty, setQty, error }: GroupProps) {
  const count = group.modifiers.reduce((n, m) => n + (qty[m.id] ?? 0), 0);
  const single = group.maxSelect === 1;
  const radio = single && group.minSelect === 1;
  const done = group.minSelect > 0 && count >= group.minSelect && count <= group.maxSelect;
  const titleId = `group-${group.id}-title`;

  // En grupos de una sola opción, elegir una reemplaza a la anterior.
  const set = (id: string, value: number) =>
    setQty((prev) => {
      const next = { ...prev };
      if (single) for (const m of group.modifiers) delete next[m.id];
      if (value > 0) next[id] = value;
      else delete next[id];
      return next;
    });

  return (
    <div
      id={`group-${group.id}`}
      role={radio ? 'radiogroup' : 'group'}
      aria-labelledby={titleId}
      className={cn('border-t border-line px-5 py-4 transition-colors', error && 'bg-accent-600/5')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={titleId} className="font-semibold">
            {group.name}
          </h3>
          <p className={cn('text-sm', error ? 'font-medium text-accent-700' : 'text-ink-muted')}>
            {error ?? ruleLabel(group)}
          </p>
        </div>
        {done && (
          <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">
            <Check className="size-4" aria-hidden />
            Listo
          </span>
        )}
      </div>

      <ul className="mt-2">
        {group.modifiers.map((m) => {
          const value = qty[m.id] ?? 0;
          const price = m.priceDelta !== 0 && (
            <span className="text-sm text-ink-muted tabular-nums">
              {m.priceDelta > 0 ? '+' : '−'} {formatARS(Math.abs(m.priceDelta))}
            </span>
          );
          const soldOut = !m.isAvailable && (
            <span className="ml-2 text-xs font-semibold text-accent-700">Agotado</span>
          );

          if (m.maxQuantity > 1) {
            const room = group.maxSelect - count;
            return (
              <li key={m.id} className="flex min-h-12 items-center gap-3 py-1.5">
                <span className="flex flex-1 flex-col">
                  <span>
                    {m.name}
                    {soldOut}
                  </span>
                  {price}
                </span>
                <QuantityStepper
                  value={value}
                  onChange={(n) => set(m.id, n)}
                  min={0}
                  max={m.isAvailable ? Math.min(m.maxQuantity, value + room) : value}
                  label={m.name}
                />
              </li>
            );
          }

          // Un agotado ya elegido (al editar) se puede destildar, no tildar.
          const disabled = value === 0 && (!m.isAvailable || (!single && count >= group.maxSelect));
          return (
            <li key={m.id}>
              <label
                className={cn(
                  'flex min-h-12 cursor-pointer items-center gap-3 py-1.5',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type={radio ? 'radio' : 'checkbox'}
                  name={group.id}
                  checked={value > 0}
                  disabled={disabled}
                  onChange={(e) => set(m.id, e.target.checked ? 1 : 0)}
                  className="size-5 shrink-0 accent-brand-600"
                />
                <span className="flex-1">
                  {m.name}
                  {soldOut}
                </span>
                {price}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
