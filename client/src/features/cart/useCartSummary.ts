import { useMemo } from 'react';
import { unitPrice, validateSelections } from '@burger/shared';
import { useProducts } from '@/features/menu/queries';
import { useCart } from './store';

// Cruza el carrito (ids) con el catálogo vigente: nombre, resumen de la
// personalización, precio y si la línea sigue siendo válida (producto o
// modificador agotado o eliminado => hay que editarla o sacarla).
export function useCartSummary() {
  const items = useCart((s) => s.items);
  const { data: products } = useProducts();

  return useMemo(() => {
    const byId = new Map(products?.map((p) => [p.id, p]));
    const lines = items.map((item) => {
      const product = byId.get(item.productId);
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
      const valid =
        product.isAvailable && validateSelections(product, item.selections).length === 0;
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
      ready: products !== undefined,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + (l.valid ? l.total : 0), 0),
      hasInvalid: lines.some((l) => !l.valid),
    };
  }, [items, products]);
}
