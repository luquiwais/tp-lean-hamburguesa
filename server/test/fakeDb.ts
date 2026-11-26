import { randomUUID } from 'node:crypto';
import type { OrderStatus } from '@burger/shared';
import { conflict } from '../src/lib/errors';
import type {
  AdminCategoryRow,
  AdminProductRow,
  SettingsRow,
} from '../src/repositories/adminCatalog.repository';
import type { CategoryRow, ProductDetailRow } from '../src/repositories/catalog.repository';
import type { CouponRow } from '../src/repositories/coupon.repository';
import type {
  CreateOrderItemPayload,
  CreateOrderPayload,
  OrderRow,
} from '../src/repositories/order.repository';
import type { RefreshTokenRow } from '../src/repositories/refreshToken.repository';
import type { UserRow, UserWithHashRow } from '../src/repositories/user.repository';

// =====================================================================
// Base de datos en memoria para los tests de la API. Implementa la misma
// interfaz que los repositories reales (server/src/repositories), que se
// reemplazan con vi.mock en setup.ts. El resto de la app (rutas,
// middlewares, validacion, services, errorHandler) corre tal cual.
// =====================================================================

// --- IDs fijos de los datos de prueba ---------------------------------
export const IDS = {
  catBurgers: '10000000-0000-4000-8000-000000000001',
  catBebidas: '10000000-0000-4000-8000-000000000002',
  catOculta: '10000000-0000-4000-8000-000000000003',
  clasica: '20000000-0000-4000-8000-000000000001', // $9000, pan obligatorio + extras
  coca: '20000000-0000-4000-8000-000000000002', // $2500, sin grupos
  agotada: '20000000-0000-4000-8000-000000000003', // is_available = false
  oculta: '20000000-0000-4000-8000-000000000004', // categoria inactiva
  grupoPan: '30000000-0000-4000-8000-000000000001',
  grupoExtras: '30000000-0000-4000-8000-000000000002',
  brioche: '40000000-0000-4000-8000-000000000001', // +$0 (default)
  panPapa: '40000000-0000-4000-8000-000000000002', // +$500
  bacon: '40000000-0000-4000-8000-000000000003', // +$1500, hasta x2
  cheddar: '40000000-0000-4000-8000-000000000004', // +$1000, hasta x1
  noDisponible: '40000000-0000-4000-8000-000000000005', // is_available = false
} as const;

interface ProductFixture extends Omit<ProductDetailRow, 'categories'> {
  is_active: boolean;
}

const grupoPan = {
  id: IDS.grupoPan,
  code: 'pan',
  name: 'Pan',
  description: 'Elegi tu pan',
  min_select: 1,
  max_select: 1,
  modifiers: [
    {
      id: IDS.brioche,
      name: 'Brioche',
      price_delta: 0,
      max_quantity: 1,
      is_default: true,
      is_available: true,
      sort_order: 1,
    },
    {
      id: IDS.panPapa,
      name: 'Pan de papa',
      price_delta: 500,
      max_quantity: 1,
      is_default: false,
      is_available: true,
      sort_order: 2,
    },
  ],
};

const grupoExtras = {
  id: IDS.grupoExtras,
  code: 'extras',
  name: 'Extras',
  description: 'Hasta 3',
  min_select: 0,
  max_select: 3,
  modifiers: [
    {
      id: IDS.bacon,
      name: 'Bacon',
      price_delta: 1500,
      max_quantity: 2,
      is_default: false,
      is_available: true,
      sort_order: 1,
    },
    {
      id: IDS.cheddar,
      name: 'Cheddar',
      price_delta: 1000,
      max_quantity: 1,
      is_default: false,
      is_available: true,
      sort_order: 2,
    },
    {
      id: IDS.noDisponible,
      name: 'Huevo',
      price_delta: 800,
      max_quantity: 1,
      is_default: false,
      is_available: false,
      sort_order: 3,
    },
  ],
};

function product(
  fields: Pick<ProductFixture, 'id' | 'category_id' | 'slug' | 'name' | 'base_price'> &
    Partial<ProductFixture>,
): ProductFixture {
  return {
    description: '',
    image_url: null,
    type: 'simple',
    badges: [],
    sort_order: 1,
    is_available: true,
    is_active: true,
    product_modifier_groups: [],
    ...fields,
  };
}

function fixtures() {
  const categories: AdminCategoryRow[] = [
    {
      id: IDS.catBurgers,
      slug: 'hamburguesas',
      name: 'Hamburguesas',
      sort_order: 1,
      is_active: true,
    },
    { id: IDS.catBebidas, slug: 'bebidas', name: 'Bebidas', sort_order: 2, is_active: true },
    { id: IDS.catOculta, slug: 'ocultos', name: 'Ocultos', sort_order: 3, is_active: false },
  ];

  const products: ProductFixture[] = [
    product({
      id: IDS.clasica,
      category_id: IDS.catBurgers,
      slug: 'clasica',
      name: 'Clasica',
      base_price: 9000,
      badges: ['nuevo', 'badge-inventado'],
      product_modifier_groups: [
        { sort_order: 2, modifier_groups: structuredClone(grupoExtras) },
        { sort_order: 1, modifier_groups: structuredClone(grupoPan) },
      ],
    }),
    product({
      id: IDS.agotada,
      category_id: IDS.catBurgers,
      slug: 'agotada',
      name: 'Agotada',
      base_price: 8000,
      sort_order: 2,
      is_available: false,
    }),
    product({
      id: IDS.coca,
      category_id: IDS.catBebidas,
      slug: 'coca',
      name: 'Coca',
      base_price: 2500,
    }),
    product({
      id: IDS.oculta,
      category_id: IDS.catOculta,
      slug: 'oculta',
      name: 'Oculta',
      base_price: 1000,
    }),
  ];

  const settings: SettingsRow = {
    is_open: true,
    delivery_fee: 2500,
    min_order_delivery: 12000,
    free_delivery_threshold: 35000,
    eta_min: 30,
    eta_max: 45,
    auto_advance: false,
  };

  const coupons: CouponRow[] = [
    {
      id: randomUUID(),
      code: 'BIENVENIDA10',
      type: 'percent',
      value: 10,
      min_total: 15000,
      max_uses: null,
      used_count: 0,
      expires_at: null,
      is_active: true,
    },
    {
      id: randomUUID(),
      code: 'VENCIDO',
      type: 'fixed',
      value: 1000,
      min_total: 0,
      max_uses: null,
      used_count: 0,
      expires_at: '2020-01-01T00:00:00Z',
      is_active: true,
    },
  ];

  return { categories, products, settings, coupons };
}

// --- Estado mutable (se resetea antes de cada test) --------------------
export const db = {
  ...fixtures(),
  users: new Map<string, UserWithHashRow>(),
  refreshTokens: new Map<string, RefreshTokenRow>(),
  orders: new Map<string, OrderRow & { updated_at: string }>(),
  // Lo que el service le mando a create_order, para verificar que nunca se
  // guarda el numero de tarjeta ni el CVV.
  orderPayloads: [] as { order: CreateOrderPayload; items: CreateOrderItemPayload[] }[],
  uploads: [] as string[],
  removedUrls: [] as string[],
  nextOrderNumber: 1,
  failCatalog: false, // simula una caida de la DB
};

export function resetDb() {
  Object.assign(db, fixtures());
  db.users.clear();
  db.refreshTokens.clear();
  db.orders.clear();
  db.orderPayloads = [];
  db.uploads = [];
  db.removedUrls = [];
  db.nextOrderNumber = 1;
  db.failCatalog = false;
}

const now = () => new Date().toISOString();

function toDetailRow(p: ProductFixture): ProductDetailRow {
  const { is_active: _active, ...rest } = structuredClone(p);
  const cat = db.categories.find((c) => c.id === p.category_id);
  return { ...rest, categories: cat ? { slug: cat.slug, is_active: cat.is_active } : null };
}

function assertCatalogUp() {
  // Error "crudo" con detalles internos: el errorHandler no debe filtrarlos.
  if (db.failCatalog) {
    throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432 relation "products"'), {
      code: 'XX000',
    });
  }
}

// --- Repositories falsos ------------------------------------------------

export const fakeCatalogRepository = {
  async getStoreSettings() {
    assertCatalogUp();
    const { auto_advance: _a, ...rest } = db.settings;
    return { ...rest };
  },
  async listActiveCategories(): Promise<CategoryRow[]> {
    assertCatalogUp();
    return db.categories
      .filter((c) => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ is_active: _a, ...c }) => c);
  },
  async listActiveProducts() {
    assertCatalogUp();
    return db.products
      .filter((p) => p.is_active)
      .map((p) => {
        const { is_active: _a, product_modifier_groups, ...rest } = structuredClone(p);
        return {
          ...rest,
          product_modifier_groups: product_modifier_groups.map((pmg) => ({
            modifier_groups: pmg.modifier_groups && { min_select: pmg.modifier_groups.min_select },
          })),
        };
      });
  },
  async findActiveProductBySlug(slug: string) {
    assertCatalogUp();
    const p = db.products.find((x) => x.slug === slug && x.is_active);
    return p ? toDetailRow(p) : null;
  },
  async findActiveProductsByIds(ids: string[]) {
    assertCatalogUp();
    return db.products.filter((p) => ids.includes(p.id) && p.is_active).map(toDetailRow);
  },
};

export const fakeCouponRepository = {
  async findByCode(code: string) {
    return db.coupons.find((c) => c.code === code) ?? null;
  },
};

const publicUser = ({ password_hash: _h, ...u }: UserWithHashRow): UserRow => ({ ...u });

export const fakeUserRepository = {
  async findByEmailWithHash(email: string) {
    return [...db.users.values()].find((u) => u.email === email) ?? null;
  },
  async findById(id: string) {
    const u = db.users.get(id);
    return u ? publicUser(u) : null;
  },
  async create(input: {
    email: string;
    passwordHash: string;
    name: string;
    phone: string | null;
    role?: UserRow['role'];
  }) {
    if ([...db.users.values()].some((u) => u.email === input.email)) {
      throw conflict('Ya existe una cuenta con ese email');
    }
    const row: UserWithHashRow = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role ?? 'customer',
      password_hash: input.passwordHash,
    };
    db.users.set(row.id, row);
    return publicUser(row);
  },
  async update(id: string, fields: Partial<UserWithHashRow>) {
    const u = db.users.get(id)!;
    Object.assign(u, fields);
    return publicUser(u);
  },
};

export const fakeRefreshTokenRepository = {
  async create(input: { userId: string; familyId: string; tokenHash: string; expiresAt: Date }) {
    const row: RefreshTokenRow = {
      id: randomUUID(),
      user_id: input.userId,
      family_id: input.familyId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt.toISOString(),
      revoked_at: null,
    };
    db.refreshTokens.set(row.id, row);
    return { ...row };
  },
  async findByHash(tokenHash: string) {
    const row = [...db.refreshTokens.values()].find((t) => t.token_hash === tokenHash);
    return row ? { ...row } : null;
  },
  async revokeIfActive(id: string, _replacedBy: string | null) {
    const row = db.refreshTokens.get(id);
    if (!row || row.revoked_at) return false;
    row.revoked_at = now();
    return true;
  },
  async revokeFamily(familyId: string) {
    for (const row of db.refreshTokens.values()) {
      if (row.family_id === familyId && !row.revoked_at) row.revoked_at = now();
    }
  },
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'on_the_way',
  'ready_for_pickup',
];

export const fakeOrderRepository = {
  async create(order: CreateOrderPayload, items: CreateOrderItemPayload[]) {
    db.orderPayloads.push(structuredClone({ order, items }));
    const id = randomUUID();
    const createdAt = now();
    const row: OrderRow & { updated_at: string } = {
      id,
      order_number: db.nextOrderNumber++,
      user_id: order.user_id,
      status: 'pending',
      fulfillment: order.fulfillment,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address_snapshot: order.address_snapshot,
      subtotal: order.subtotal,
      delivery_fee: order.delivery_fee,
      discount: order.discount,
      total: order.total,
      coupon_code: order.coupon_code,
      payment_method: order.payment_method,
      payment_brand: order.payment_brand,
      payment_last4: order.payment_last4,
      cash_amount: order.cash_amount,
      notes: order.notes,
      created_at: createdAt,
      updated_at: createdAt,
      order_items: items.map((i) => ({
        id: randomUUID(),
        product_id: i.product_id,
        product_name: i.product_name,
        unit_base_price: i.unit_base_price,
        quantity: i.quantity,
        item_total: i.item_total,
        notes: i.notes,
        order_item_modifiers: i.modifiers.map((m) => ({
          group_name: m.group_name,
          modifier_name: m.modifier_name,
          price_delta: m.price_delta,
          quantity: m.quantity,
        })),
      })),
      order_status_history: [{ status: 'pending', changed_at: createdAt, note: null }],
    };
    db.orders.set(id, row);
    return { id, order_number: row.order_number };
  },
  async findById(id: string) {
    const row = db.orders.get(id);
    return row ? structuredClone(row) : null;
  },
  async listByUser(userId: string) {
    return [...db.orders.values()]
      .filter((o) => o.user_id === userId)
      .map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        fulfillment: o.fulfillment,
        total: o.total,
        created_at: o.created_at,
        order_items: o.order_items.map((i) => ({ quantity: i.quantity })),
      }));
  },
  // Concurrencia optimista, igual que la funcion change_order_status.
  async changeStatus(input: {
    orderId: string;
    from: OrderStatus;
    to: OrderStatus;
    changedBy: string | null;
    note?: string;
  }) {
    const row = db.orders.get(input.orderId);
    if (!row || row.status !== input.from) return false;
    row.status = input.to;
    row.updated_at = now();
    row.order_status_history.push({
      status: input.to,
      changed_at: row.updated_at,
      note: input.note ?? null,
    });
    return true;
  },
  async listAdmin(filters: {
    status?: OrderStatus;
    active?: boolean;
    page: number;
    pageSize: number;
  }) {
    let rows = [...db.orders.values()];
    if (filters.status) rows = rows.filter((o) => o.status === filters.status);
    if (filters.active) rows = rows.filter((o) => ACTIVE_STATUSES.includes(o.status));
    const from = (filters.page - 1) * filters.pageSize;
    return {
      total: rows.length,
      rows: rows.slice(from, from + filters.pageSize).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        fulfillment: o.fulfillment,
        customer_name: o.customer_name,
        total: o.total,
        created_at: o.created_at,
        updated_at: o.updated_at,
        order_items: o.order_items.map((i) => ({ quantity: i.quantity })),
      })),
    };
  },
  async listSince(since: Date) {
    return [...db.orders.values()]
      .filter((o) => new Date(o.created_at) >= since)
      .map((o) => ({
        status: o.status,
        fulfillment: o.fulfillment,
        total: o.total,
        created_at: o.created_at,
        order_items: o.order_items.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          item_total: i.item_total,
        })),
      }));
  },
  async countByStatus(statuses: OrderStatus[]) {
    return [...db.orders.values()].filter((o) => statuses.includes(o.status)).length;
  },
  async listStaleActive(before: Date) {
    return [...db.orders.values()]
      .filter((o) => ACTIVE_STATUSES.includes(o.status) && new Date(o.updated_at) < before)
      .map((o) => ({ id: o.id, status: o.status, fulfillment: o.fulfillment }));
  },
};

function toAdminProductRow(p: ProductFixture): AdminProductRow {
  return {
    id: p.id,
    category_id: p.category_id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    base_price: p.base_price,
    image_url: p.image_url,
    type: p.type,
    badges: [...p.badges],
    sort_order: p.sort_order,
    is_available: p.is_available,
    is_active: p.is_active,
    product_modifier_groups: p.product_modifier_groups
      .filter((pmg) => pmg.modifier_groups)
      .map((pmg) => ({ group_id: pmg.modifier_groups!.id, sort_order: pmg.sort_order })),
  };
}

// Solo lo que usan los tests de admin; el resto falla explicito.
export const fakeAdminCatalogRepository = new Proxy(
  {
    async listCategories() {
      return structuredClone(db.categories);
    },
    async createCategory(row: Omit<AdminCategoryRow, 'id'>) {
      if (db.categories.some((c) => c.slug === row.slug)) {
        throw conflict('Ya existe una categoria con ese nombre o slug');
      }
      const created = { id: randomUUID(), ...row };
      db.categories.push(created);
      return { ...created };
    },
    async listProducts() {
      return db.products.map(toAdminProductRow);
    },
    async findProduct(id: string) {
      const p = db.products.find((x) => x.id === id);
      return p ? toAdminProductRow(p) : null;
    },
    async updateProduct(id: string, fields: Partial<ProductFixture>) {
      const p = db.products.find((x) => x.id === id);
      if (!p) return false;
      Object.assign(p, fields);
      return true;
    },
    async getSettings() {
      return { ...db.settings };
    },
    async updateSettings(fields: Partial<SettingsRow>) {
      const next = { ...db.settings, ...fields };
      if (next.eta_min > next.eta_max) {
        throw conflict('El tiempo minimo no puede superar al maximo');
      }
      db.settings = next;
      return { ...next };
    },
  } as Record<string, unknown>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {
        throw new Error(`fakeAdminCatalogRepository.${prop} no implementado`);
      };
    },
  },
);

export const fakeStorageRepository = {
  async upload(path: string) {
    db.uploads.push(path);
    return `https://test-project.supabase.co/storage/v1/object/public/products/${path}`;
  },
  async removeByPublicUrl(url: string | null) {
    if (url) db.removedUrls.push(url);
  },
};
