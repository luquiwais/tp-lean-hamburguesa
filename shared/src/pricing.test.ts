import { describe, expect, it } from 'vitest';
import { unitPrice, validateSelections, type PricedProduct } from './pricing';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const burger: PricedProduct = {
  basePrice: 10000,
  modifierGroups: [
    {
      id: id(10),
      name: 'Medallones',
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        {
          id: id(11),
          name: 'Simple',
          priceDelta: 0,
          isDefault: true,
          isAvailable: true,
          maxQuantity: 1,
        },
        {
          id: id(12),
          name: 'Doble',
          priceDelta: 3000,
          isDefault: false,
          isAvailable: true,
          maxQuantity: 1,
        },
      ],
    },
    {
      id: id(20),
      name: 'Agregale',
      minSelect: 0,
      maxSelect: 3,
      modifiers: [
        {
          id: id(21),
          name: 'Cheddar',
          priceDelta: 900,
          isDefault: false,
          isAvailable: true,
          maxQuantity: 2,
        },
        {
          id: id(22),
          name: 'Panceta',
          priceDelta: 1300,
          isDefault: false,
          isAvailable: true,
          maxQuantity: 1,
        },
        {
          id: id(23),
          name: 'Huevo',
          priceDelta: 800,
          isDefault: false,
          isAvailable: false,
          maxQuantity: 1,
        },
      ],
    },
  ],
};

const sel = (n: number, quantity = 1) => ({ modifierId: id(n), quantity });
const messages = (selections: ReturnType<typeof sel>[]) =>
  validateSelections(burger, selections).map((i) => i.message);

describe('validateSelections', () => {
  it('acepta una personalización válida', () => {
    expect(messages([sel(12), sel(21, 2), sel(22)])).toEqual([]);
  });

  it('exige los grupos obligatorios', () => {
    expect(messages([])).toEqual(['Elegí 1']);
  });

  it('respeta el máximo del grupo contando cantidades', () => {
    expect(messages([sel(11), sel(21, 2), sel(22, 1)])).toEqual([]);
    expect(messages([sel(11), sel(11)])).toContain('Opción repetida');
    expect(messages([sel(11), sel(12)])).toEqual(['Elegí hasta 1']);
  });

  it('respeta el tope por modificador', () => {
    expect(messages([sel(11), sel(22, 2)])).toEqual(['Hasta 1 de Panceta']);
  });

  it('rechaza agotados, ids ajenos y cantidades inválidas', () => {
    expect(messages([sel(11), sel(23)])).toEqual(['Huevo está agotado']);
    expect(messages([sel(11), sel(99)])).toEqual(['Opción inválida']);
    expect(messages([sel(11), sel(21, 0)])).toEqual(['Cantidad inválida']);
  });
});

describe('unitPrice', () => {
  it('suma base + modificadores por cantidad', () => {
    expect(unitPrice(burger, [sel(12), sel(21, 2)])).toBe(10000 + 3000 + 900 * 2);
  });
});
