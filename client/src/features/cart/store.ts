import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MAX_ITEM_QUANTITY, type Selection } from '@burger/shared';

// El carrito guarda solo ids, slug y cantidades; nombres y precios salen del
// detalle vigente de cada producto (useCartSummary), así nunca muestra un precio viejo.
// Persistido en localStorage para el invitado; la sync con la cuenta llega
// con la auth (Fase 3/5).
export type CartItem = {
  id: string;
  productId: string;
  productSlug: string; // GET /api/products/:slug es por slug
  quantity: number;
  selections: Selection[];
  notes: string;
};

type NewItem = Omit<CartItem, 'id'>;

type CartState = {
  items: CartItem[];
  add: (item: NewItem) => void;
  update: (id: string, item: NewItem) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const selectionKey = (selections: Selection[]) =>
  selections
    .map((s) => `${s.modifierId}:${s.quantity}`)
    .sort()
    .join(',');

// Mismo producto, misma personalización y mismas notas => misma línea.
const sameLine = (a: NewItem, b: NewItem) =>
  a.productId === b.productId &&
  a.notes === b.notes &&
  selectionKey(a.selections) === selectionKey(b.selections);

const clampQty = (n: number) => Math.min(Math.max(1, n), MAX_ITEM_QUANTITY);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set(({ items }) => {
          const existing = items.find((i) => sameLine(i, item));
          if (!existing) return { items: [...items, { ...item, id: crypto.randomUUID() }] };
          return {
            items: items.map((i) =>
              i === existing ? { ...i, quantity: clampQty(i.quantity + item.quantity) } : i,
            ),
          };
        }),
      update: (id, item) =>
        set(({ items }) => ({ items: items.map((i) => (i.id === id ? { ...item, id } : i)) })),
      setQuantity: (id, quantity) =>
        set(({ items }) => ({
          items: items.map((i) => (i.id === id ? { ...i, quantity: clampQty(quantity) } : i)),
        })),
      remove: (id) => set(({ items }) => ({ items: items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'burger-cart',
      version: 2,
      // v1 no tenía productSlug (y eran datos de mocks): se arranca vacío.
      migrate: () => ({ items: [] }) as unknown as CartState,
    },
  ),
);
