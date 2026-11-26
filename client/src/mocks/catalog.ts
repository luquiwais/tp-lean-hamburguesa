import type { Category, ProductInput, StoreSettingsInput } from '@burger/shared';

// Catálogo de ejemplo con la forma exacta del contrato (shared/src/schemas/catalog.ts).
// Se usa hasta que el back sirva el catálogo real y sirve de base para el seed (Fase 1).
// Fotos de Unsplash (licencia Unsplash, uso libre).

const uid = (kind: number, n: number) =>
  `00000000-0000-4000-8000-${String(kind * 1000 + n).padStart(12, '0')}`;
const img = (photo: string) =>
  `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=800&q=70`;

const cat = {
  hamburguesas: uid(1, 1),
  combos: uid(1, 2),
  acompanar: uid(1, 3),
  bebidas: uid(1, 4),
  postres: uid(1, 5),
};

export const categories: Category[] = [
  { id: cat.hamburguesas, name: 'Hamburguesas', slug: 'hamburguesas' },
  { id: cat.combos, name: 'Combos', slug: 'combos' },
  { id: cat.acompanar, name: 'Para acompañar', slug: 'para-acompanar' },
  { id: cat.bebidas, name: 'Bebidas', slug: 'bebidas' },
  { id: cat.postres, name: 'Postres', slug: 'postres' },
];

type GroupInput = ProductInput['modifierGroups'][number];
type ModifierExtras = { isDefault?: boolean; isAvailable?: boolean; maxQuantity?: number };

let modifierCount = 0;
const mod = (name: string, priceDelta = 0, extras: ModifierExtras = {}) => ({
  id: uid(3, ++modifierCount),
  name,
  priceDelta,
  isDefault: false,
  isAvailable: true,
  ...extras,
});

const medallones: GroupInput = {
  id: uid(2, 1),
  name: 'Medallones',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [mod('Simple', 0, { isDefault: true }), mod('Doble', 2900), mod('Triple', 5200)],
};
const pan: GroupInput = {
  id: uid(2, 2),
  name: 'Cambiá el pan',
  minSelect: 0,
  maxSelect: 1,
  modifiers: [mod('Pan brioche'), mod('Pan sin TACC', 900)],
};
const extras: GroupInput = {
  id: uid(2, 3),
  name: 'Agregale',
  minSelect: 0,
  maxSelect: 4,
  modifiers: [
    mod('Cheddar extra', 900, { maxQuantity: 2 }),
    mod('Panceta crocante', 1300, { maxQuantity: 2 }),
    mod('Huevo a la plancha', 800),
    mod('Cebolla caramelizada', 700),
    mod('Pepinos', 400),
  ],
};
const sacale: GroupInput = {
  id: uid(2, 4),
  name: 'Sacale',
  minSelect: 0,
  maxSelect: 5,
  modifiers: [
    mod('Sin cebolla'),
    mod('Sin pepinos'),
    mod('Sin tomate'),
    mod('Sin lechuga'),
    mod('Sin salsa'),
  ],
};
const papasCombo: GroupInput = {
  id: uid(2, 5),
  name: 'Papas del combo',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [
    mod('Clásicas', 0, { isDefault: true }),
    mod('Rústicas con pimentón', 800),
    mod('Con cheddar y panceta', 2200),
  ],
};
const bebidaCombo: GroupInput = {
  id: uid(2, 6),
  name: 'Bebida del combo',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [
    mod('Gaseosa cola 500 ml', 0, { isDefault: true }),
    mod('Gaseosa lima-limón 500 ml'),
    mod('Agua sin gas 500 ml'),
    mod('Agua con gas 500 ml', 0, { isAvailable: false }),
    mod('Limonada de la casa', 900),
  ],
};
const bebidasParaDos: GroupInput = {
  id: uid(2, 7),
  name: 'Bebidas',
  minSelect: 2,
  maxSelect: 2,
  modifiers: [
    mod('Gaseosa cola 500 ml', 0, { maxQuantity: 2 }),
    mod('Gaseosa lima-limón 500 ml', 0, { maxQuantity: 2 }),
    mod('Agua sin gas 500 ml', 0, { maxQuantity: 2 }),
    mod('Limonada de la casa', 900, { maxQuantity: 2 }),
  ],
};
const tamanoPapas: GroupInput = {
  id: uid(2, 8),
  name: 'Tamaño',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [mod('Chicas', 0, { isDefault: true }), mod('Medianas', 1200), mod('Grandes', 2100)],
};
const dips: GroupInput = {
  id: uid(2, 9),
  name: 'Sumale dips',
  minSelect: 0,
  maxSelect: 3,
  modifiers: [
    mod('Cheddar', 700),
    mod('Alioli', 500),
    mod('Barbacoa', 500),
    mod('Mayo de ajo ahumado', 600),
  ],
};
const saborGaseosa: GroupInput = {
  id: uid(2, 10),
  name: 'Sabor',
  minSelect: 1,
  maxSelect: 1,
  modifiers: [mod('Cola', 0, { isDefault: true }), mod('Lima-limón'), mod('Pomelo')],
};

const burger = [medallones, pan, extras, sacale];
const burgerFixed = [pan, extras, sacale];

type Draft = Pick<ProductInput, 'name' | 'slug' | 'description' | 'basePrice'> &
  Partial<ProductInput>;

let productCount = 0;
const product = (categoryId: string, draft: Draft): ProductInput => ({
  id: uid(4, ++productCount),
  categoryId,
  imageUrl: null,
  type: 'simple',
  badges: [],
  isAvailable: true,
  modifierGroups: [],
  ...draft,
});

export const products: ProductInput[] = [
  product(cat.hamburguesas, {
    name: 'Clásica',
    slug: 'clasica',
    description:
      'Medallón de carne de pastura, cheddar, lechuga, tomate y salsa de la casa en pan de papa.',
    badges: ['popular'],
    basePrice: 9800,
    imageUrl: img('1571091718767-18b5b1457add'),
    modifierGroups: burger,
  }),
  product(cat.hamburguesas, {
    name: 'Doble Cheddar',
    slug: 'doble-cheddar',
    description: 'Dos medallones smash con bordes crocantes, doble cheddar, pepinos y cebolla.',
    badges: ['popular'],
    basePrice: 12400,
    imageUrl: img('1607013251379-e6eecfffe234'),
    modifierGroups: burgerFixed,
  }),
  product(cat.hamburguesas, {
    name: 'Panceta BBQ',
    slug: 'panceta-bbq',
    description: 'Doble medallón, panceta crocante, cheddar, cebolla crispy y barbacoa ahumada.',
    badges: ['popular'],
    basePrice: 13900,
    imageUrl: img('1553979459-d2229ba7433b'),
    modifierGroups: burgerFixed,
  }),
  product(cat.hamburguesas, {
    name: 'Triple Smash',
    slug: 'triple-smash',
    description: 'Tres medallones finitos aplastados en la plancha, triple cheddar y pepinos.',
    basePrice: 15600,
    imageUrl: img('1572802419224-296b0aeee0d9'),
    badges: ['nuevo'],
    modifierGroups: burgerFixed,
  }),
  product(cat.hamburguesas, {
    name: 'La de la Casa',
    slug: 'la-de-la-casa',
    description: 'Medallón, cheddar, cebolla morada, tomate, lechuga y nuestra salsa secreta.',
    basePrice: 11200,
    imageUrl: img('1568901346375-23c9450c58cd'),
    modifierGroups: burger,
  }),
  product(cat.hamburguesas, {
    name: 'Diabla',
    slug: 'diabla',
    description: 'Medallón, pepper jack, jalapeños, cebolla crispy y mayo de chipotle.',
    basePrice: 11900,
    imageUrl: img('1586190848861-99aa4a171e90'),
    badges: ['picante'],
    modifierGroups: burger,
  }),
  product(cat.hamburguesas, {
    name: 'Cheddar y Huevo',
    slug: 'cheddar-y-huevo',
    description: 'Medallón, cheddar fundido, huevo a la plancha y jamón cocido.',
    basePrice: 11600,
    imageUrl: img('1565299507177-b0ac66763828'),
    modifierGroups: burger,
  }),
  product(cat.hamburguesas, {
    name: 'Guacamole',
    slug: 'guacamole',
    description: 'Medallón, guacamole, tomate, cebolla morada y un toque de lima.',
    basePrice: 12100,
    imageUrl: img('1520072959219-c595dc870360'),
    badges: ['nuevo'],
    modifierGroups: burger,
  }),
  product(cat.hamburguesas, {
    name: 'Crispy',
    slug: 'crispy',
    description: 'Pechuga rebozada crocante, coleslaw, pepinos y mayo picante.',
    basePrice: 11400,
    imageUrl: img('1606755962773-d324e0a13086'),
    badges: ['picante'],
    modifierGroups: burgerFixed,
  }),
  product(cat.hamburguesas, {
    name: 'Veggie de la Huerta',
    slug: 'veggie-de-la-huerta',
    description: 'Medallón de garbanzos y hongos, palta, tomate, rúcula y mayo de lima.',
    basePrice: 10900,
    imageUrl: img('1525059696034-4967a8e1dca2'),
    badges: ['veggie'],
    modifierGroups: [pan, sacale],
  }),

  product(cat.combos, {
    name: 'Combo Clásica',
    slug: 'combo-clasica',
    description: 'Clásica + papas + bebida. El de siempre.',
    badges: ['popular'],
    basePrice: 14900,
    type: 'combo',
    imageUrl: img('1594212699903-ec8a3eca50f5'),
    modifierGroups: [medallones, papasCombo, bebidaCombo, sacale],
  }),
  product(cat.combos, {
    name: 'Combo Doble Cheddar',
    slug: 'combo-doble-cheddar',
    description: 'Doble Cheddar + papas + bebida.',
    basePrice: 16900,
    type: 'combo',
    imageUrl: img('1551782450-a2132b4ba21d'),
    modifierGroups: [papasCombo, bebidaCombo, extras, sacale],
  }),
  product(cat.combos, {
    name: 'Combo para Dos',
    slug: 'combo-para-dos',
    description: 'Dos Clásicas simples, papas grandes para compartir y dos bebidas.',
    basePrice: 26900,
    type: 'combo',
    imageUrl: img('1561758033-d89a9ad46330'),
    modifierGroups: [bebidasParaDos, sacale],
  }),

  product(cat.acompanar, {
    name: 'Papas clásicas',
    slug: 'papas-clasicas',
    description: 'Bastón, fritas en el momento, con sal marina.',
    basePrice: 4200,
    imageUrl: img('1630384060421-cb20d0e0649d'),
    badges: ['veggie', 'sin_tacc', 'popular'],
    modifierGroups: [tamanoPapas, dips],
  }),
  product(cat.acompanar, {
    name: 'Papas rústicas',
    slug: 'papas-rusticas',
    description: 'Con cáscara, pimentón ahumado y romero.',
    basePrice: 4900,
    imageUrl: img('1541592106381-b31e9677c0e5'),
    badges: ['veggie'],
    modifierGroups: [tamanoPapas, dips],
  }),
  product(cat.acompanar, {
    name: 'Papas con parmesano',
    slug: 'papas-con-parmesano',
    description: 'Bastón con parmesano, ajo y perejil.',
    basePrice: 5600,
    imageUrl: img('1573080496219-bb080dd4f877'),
    modifierGroups: [tamanoPapas, dips],
  }),
  product(cat.acompanar, {
    name: 'Aros de cebolla',
    slug: 'aros-de-cebolla',
    description: 'Rebozados en cerveza, con dip de barbacoa.',
    basePrice: 4800,
    imageUrl: img('1639024471283-03518883512d'),
    badges: ['veggie'],
  }),
  product(cat.acompanar, {
    name: 'Bocaditos de pollo',
    slug: 'bocaditos-de-pollo',
    description: 'Seis bocaditos crocantes con dip de miel y mostaza.',
    basePrice: 6400,
    imageUrl: img('1626082927389-6cd097cdc6ec'),
    modifierGroups: [dips],
  }),

  product(cat.bebidas, {
    name: 'Gaseosa 500 ml',
    slug: 'gaseosa',
    description: 'Cola, lima-limón o pomelo, bien fría.',
    basePrice: 2600,
    imageUrl: img('1581636625402-29b2a704ef13'),
    modifierGroups: [saborGaseosa],
  }),
  product(cat.bebidas, {
    name: 'Agua sin gas 500 ml',
    slug: 'agua-sin-gas',
    description: 'Agua mineral natural.',
    basePrice: 2200,
  }),
  product(cat.bebidas, {
    name: 'Limonada de la casa',
    slug: 'limonada',
    description: 'Limón exprimido, menta y jengibre. 500 ml.',
    basePrice: 3900,
    badges: ['nuevo'],
  }),

  product(cat.postres, {
    name: 'Shake de cookies',
    slug: 'shake-de-cookies',
    description: 'Helado de vainilla, cookies trituradas y salsa de chocolate.',
    basePrice: 5900,
    imageUrl: img('1572490122747-3968b75cc699'),
  }),
  product(cat.postres, {
    name: 'Shake de frutilla',
    slug: 'shake-de-frutilla',
    description: 'Helado de vainilla y frutillas frescas.',
    basePrice: 5600,
    imageUrl: img('1579954115545-a95591f28bfc'),
    badges: ['sin_tacc'],
  }),
  product(cat.postres, {
    name: 'Sundae de brownie',
    slug: 'sundae-de-brownie',
    description: 'Helado, brownie, cookies y dulce de leche.',
    basePrice: 5200,
    imageUrl: img('1563805042-7684c019e1cb'),
    isAvailable: false,
  }),
];

export const store: StoreSettingsInput = {
  isOpen: true,
  deliveryFee: 1800,
  minOrderDelivery: 12000,
  freeDeliveryThreshold: 35000,
  etaMin: 30,
  etaMax: 45,
  closesAt: '23:30',
};
