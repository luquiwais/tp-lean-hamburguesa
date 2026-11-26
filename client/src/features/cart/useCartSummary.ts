import { useQueries } from '@tanstack/react-query';
import { unitPrice, validateSelections } from '@burger/shared';
import { productQuery } from '@/features/menu/queries';
import { useCart } from './store';

// Cruza el carrito con el detalle vigente de cada producto (una query por slug,
// compartida con el personalizador): nombre, resumen de la personalización,
// precio y si la línea sigue siendo válida (producto o modificador agotado o
// eliminado => hay que editarla o sacarla). El precio es solo para mostrar:
// el back lo recalcula al crear el pedido.
export function useCartSummary() {
  const items = useCart((s) => s.items);
  const slugs = [...new Set(items.map((i) => i.productSlug))];
  const { bySlug, ready } = useQueries({
    queries: slugs.map(productQuery),
    combine: (results) => ({
      bySlug: new Map(slugs.map((slug, i) => [slug, results[i]?.data])),
      ready: results.every((r) => !r.isPending),
    }),
  });

  const lines = items.map((item) => {
    const detail = bySlug.get(item.productSlug);
    const product = detail?.id === item.productId ? detail : undefined;
    if (!product) return { item, product, summary: '', total: 0, valid: false };

    const modifiers = new Map(
      product.modifierGroups.flatMap((g) => g.modifiers.map((m) => [m.id, m.name])),
    );
    const summary = item.selections
      .map((s) => {
        const name = modifiers.get(s.modifierId);
        return name && (s.quantity > 1 ? `${name} ×${s.quantity}` : name);
      })
      .filter(Boolean)
      .join(' · ');
    const valid = product.isAvailable && validateSelections(product, item.selections).length === 0;
    return {
      item,
      product,
      summary,
      total: unitPrice(product, item.selections) * item.quantity,
      valid,
    };
  });

  return {
    lines,
    ready,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: lines.reduce((sum, l) => sum + (l.valid ? l.total : 0), 0),
    hasInvalid: ready && lines.some((l) => !l.valid),
  };
}
