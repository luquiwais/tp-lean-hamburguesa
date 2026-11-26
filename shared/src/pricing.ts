// Reglas de personalización y precio de un ítem. Las usa el front para el
// personalizador y el carrito, y el back (Fase 5) para recalcular el pedido
// con los datos de la DB: así los dos lados nunca discrepan.

export const MAX_ITEM_QUANTITY = 20;

// Forma minima que necesitan las reglas: la cumplen ProductDetail (GET
// /api/products/:slug) y lo que el back arma desde la DB en POST /orders.
export interface PricedModifier {
  id: string;
  name: string;
  priceDelta: number;
  maxQuantity: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface PricedModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  modifiers: PricedModifier[];
}

export interface PricedProduct {
  basePrice: number;
  modifierGroups: PricedModifierGroup[];
}

export type Selection = { modifierId: string; quantity: number };

export type SelectionIssue = { groupId: string | null; message: string };

// Devuelve los problemas de una personalización; vacío = válida.
export function validateSelections(
  product: PricedProduct,
  selections: Selection[],
): SelectionIssue[] {
  const issues: SelectionIssue[] = [];
  const owner = new Map(
    product.modifierGroups.flatMap((g) =>
      g.modifiers.map((m) => [m.id, { group: g, modifier: m }]),
    ),
  );
  const countByGroup = new Map<string, number>();
  const seen = new Set<string>();

  for (const { modifierId, quantity } of selections) {
    const found = owner.get(modifierId);
    if (!found) {
      issues.push({ groupId: null, message: 'Opción inválida' });
      continue;
    }
    const { group, modifier } = found;
    if (seen.has(modifierId)) {
      issues.push({ groupId: group.id, message: 'Opción repetida' });
      continue;
    }
    seen.add(modifierId);
    if (!Number.isInteger(quantity) || quantity < 1) {
      issues.push({ groupId: group.id, message: 'Cantidad inválida' });
      continue;
    }
    if (!modifier.isAvailable) {
      issues.push({ groupId: group.id, message: `${modifier.name} está agotado` });
    }
    if (quantity > modifier.maxQuantity) {
      issues.push({
        groupId: group.id,
        message: `Hasta ${modifier.maxQuantity} de ${modifier.name}`,
      });
    }
    countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + quantity);
  }

  for (const group of product.modifierGroups) {
    const count = countByGroup.get(group.id) ?? 0;
    if (count < group.minSelect) {
      const message =
        group.minSelect === group.maxSelect
          ? `Elegí ${group.minSelect}`
          : `Elegí al menos ${group.minSelect}`;
      issues.push({ groupId: group.id, message });
    } else if (count > group.maxSelect) {
      issues.push({ groupId: group.id, message: `Elegí hasta ${group.maxSelect}` });
    }
  }

  return issues;
}

// Selección inicial: los modificadores marcados por defecto y disponibles.
export const defaultSelections = (product: PricedProduct): Selection[] =>
  product.modifierGroups.flatMap((g) =>
    g.modifiers
      .filter((m) => m.isDefault && m.isAvailable)
      .map((m) => ({ modifierId: m.id, quantity: 1 })),
  );

// Precio unitario: base + suma de los modificadores elegidos (por cantidad).
// Ignora ids desconocidos; validateSelections es quien los rechaza.
export function unitPrice(product: PricedProduct, selections: Selection[]): number {
  const delta = new Map(
    product.modifierGroups.flatMap((g) => g.modifiers.map((m) => [m.id, m.priceDelta])),
  );
  return selections.reduce(
    (total, s) => total + (delta.get(s.modifierId) ?? 0) * s.quantity,
    product.basePrice,
  );
}
