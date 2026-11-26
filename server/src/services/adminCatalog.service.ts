import sharp from 'sharp';
import {
  BADGES,
  slugify,
  type AdminCategory,
  type AdminModifierGroup,
  type AdminProduct,
  type AdminSettings,
  type Badge,
  type CategoryInput,
  type CategoryUpdate,
  type ModifierGroupInput,
  type ModifierGroupUpdate,
  type ModifierInput,
  type ModifierUpdate,
  type ProductInput,
  type ProductUpdate,
  type SettingsUpdate,
} from '@burger/shared';
import { catalogCache } from '../lib/cache';
import { badRequest, notFound } from '../lib/errors';
import type { Logger } from '../logger';
import {
  adminCatalogRepository as repo,
  type AdminCategoryRow,
  type AdminGroupRow,
  type AdminModifierRow,
  type AdminProductRow,
  type SettingsRow,
} from '../repositories/adminCatalog.repository';
import { storageRepository } from '../repositories/storage.repository';

// Toda escritura del catalogo invalida el cache publico del menu.
const invalidate = () => catalogCache.invalidate();

// --- Mapeos fila -> contrato ---

const toCategory = (r: AdminCategoryRow): AdminCategory => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

const toProduct = (r: AdminProductRow): AdminProduct => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  basePrice: r.base_price,
  imageUrl: r.image_url,
  type: r.type,
  badges: r.badges.filter((b): b is Badge => (BADGES as readonly string[]).includes(b)),
  sortOrder: r.sort_order,
  isAvailable: r.is_available,
  isActive: r.is_active,
  modifierGroupIds: [...r.product_modifier_groups]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((g) => g.group_id),
});

const toModifier = (m: AdminModifierRow) => ({
  id: m.id,
  name: m.name,
  priceDelta: m.price_delta,
  maxQuantity: m.max_quantity,
  isDefault: m.is_default,
  isAvailable: m.is_available,
  sortOrder: m.sort_order,
});

const toGroup = (g: AdminGroupRow): AdminModifierGroup => ({
  id: g.id,
  code: g.code,
  name: g.name,
  description: g.description,
  minSelect: g.min_select,
  maxSelect: g.max_select,
  modifiers: [...g.modifiers].sort((a, b) => a.sort_order - b.sort_order).map(toModifier),
  productCount: g.product_modifier_groups[0]?.count ?? 0,
});

const toSettings = (s: SettingsRow): AdminSettings => ({
  isOpen: s.is_open,
  deliveryFee: s.delivery_fee,
  minOrderDelivery: s.min_order_delivery,
  freeDeliveryThreshold: s.free_delivery_threshold,
  etaMin: s.eta_min,
  etaMax: s.eta_max,
  autoAdvance: s.auto_advance,
});

// Solo copia las claves definidas (PATCH parcial).
function pick<T extends object>(entries: [string, unknown][]): Partial<T> {
  return Object.fromEntries(entries.filter(([, v]) => v !== undefined)) as Partial<T>;
}

function slugOrFail(name: string, slug?: string): string {
  const value = slug ?? slugify(name);
  if (!value) throw badRequest('No se pudo generar un slug: indica uno');
  return value;
}

async function loadProduct(id: string): Promise<AdminProduct> {
  const row = await repo.findProduct(id);
  if (!row) throw notFound('Producto no encontrado');
  return toProduct(row);
}

async function loadGroup(id: string): Promise<AdminModifierGroup> {
  const row = await repo.findGroup(id);
  if (!row) throw notFound('Grupo no encontrado');
  return toGroup(row);
}

export const adminCatalogService = {
  // --- Categorias ---
  async listCategories(): Promise<AdminCategory[]> {
    return (await repo.listCategories()).map(toCategory);
  },

  async createCategory(input: CategoryInput): Promise<AdminCategory> {
    const row = await repo.createCategory({
      name: input.name,
      slug: slugOrFail(input.name, input.slug),
      sort_order: input.sortOrder,
      is_active: input.isActive,
    });
    invalidate();
    return toCategory(row);
  },

  async updateCategory(id: string, input: CategoryUpdate): Promise<AdminCategory> {
    const row = await repo.updateCategory(
      id,
      pick<AdminCategoryRow>([
        ['name', input.name],
        ['slug', input.slug],
        ['sort_order', input.sortOrder],
        ['is_active', input.isActive],
      ]),
    );
    if (!row) throw notFound('Categoria no encontrada');
    invalidate();
    return toCategory(row);
  },

  // --- Productos ---
  async listProducts(): Promise<AdminProduct[]> {
    return (await repo.listProducts()).map(toProduct);
  },

  async createProduct(input: ProductInput): Promise<AdminProduct> {
    const id = await repo.createProduct({
      category_id: input.categoryId,
      name: input.name,
      slug: slugOrFail(input.name, input.slug),
      description: input.description,
      base_price: input.basePrice,
      type: input.type,
      badges: input.badges,
      sort_order: input.sortOrder,
      is_available: input.isAvailable,
    });
    await repo.setProductGroups(id, input.modifierGroupIds);
    invalidate();
    return loadProduct(id);
  },

  async updateProduct(id: string, input: ProductUpdate): Promise<AdminProduct> {
    const fields = pick<AdminProductRow>([
      ['category_id', input.categoryId],
      ['name', input.name],
      ['slug', input.slug],
      ['description', input.description],
      ['base_price', input.basePrice],
      ['type', input.type],
      ['badges', input.badges],
      ['sort_order', input.sortOrder],
      ['is_available', input.isAvailable],
      ['is_active', input.isActive],
    ]);
    if (Object.keys(fields).length > 0 && !(await repo.updateProduct(id, fields))) {
      throw notFound('Producto no encontrado');
    }
    if (input.modifierGroupIds) {
      await loadProduct(id); // 404 antes de tocar los grupos
      await repo.setProductGroups(id, input.modifierGroupIds);
    }
    invalidate();
    return loadProduct(id);
  },

  // Baja logica: el producto desaparece del menu pero los pedidos viejos
  // siguen mostrando su nombre (snapshot) y se puede reactivar.
  async deactivateProduct(id: string): Promise<void> {
    if (!(await repo.updateProduct(id, { is_active: false }))) {
      throw notFound('Producto no encontrado');
    }
    invalidate();
  },

  // Valida que sea una imagen real (por contenido, no por extension), la
  // normaliza a WebP de hasta 800px y reemplaza la anterior.
  async uploadProductImage(id: string, file: Buffer, log: Logger): Promise<AdminProduct> {
    const current = await loadProduct(id);

    let webp: Buffer;
    try {
      const image = sharp(file, { limitInputPixels: 40_000_000 });
      const meta = await image.metadata();
      if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
        throw new Error(`formato no soportado: ${meta.format}`);
      }
      webp = await image
        .rotate() // respeta la orientacion EXIF y la descarta
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (err) {
      log.warn('image_rejected', { err, product_id: id });
      throw badRequest('El archivo no es una imagen valida (JPG, PNG o WebP)');
    }

    const url = await storageRepository.upload(`${id}/${Date.now()}.webp`, webp, 'image/webp');
    await repo.updateProduct(id, { image_url: url });
    try {
      await storageRepository.removeByPublicUrl(current.imageUrl);
    } catch (err) {
      log.warn('old_image_remove_failed', { err, product_id: id }); // no bloquea la respuesta
    }
    invalidate();
    return { ...current, imageUrl: url };
  },

  // --- Grupos y opciones ---
  async listGroups(): Promise<AdminModifierGroup[]> {
    return (await repo.listGroups()).map(toGroup);
  },

  async createGroup(input: ModifierGroupInput): Promise<AdminModifierGroup> {
    const code = input.code ?? slugify(input.name).replace(/-/g, '_').slice(0, 40);
    const id = await repo.createGroup({
      code,
      name: input.name,
      description: input.description,
      min_select: input.minSelect,
      max_select: input.maxSelect,
    });
    invalidate();
    return loadGroup(id);
  },

  async updateGroup(id: string, input: ModifierGroupUpdate): Promise<AdminModifierGroup> {
    const fields = pick<{
      name: string;
      description: string;
      min_select: number;
      max_select: number;
    }>([
      ['name', input.name],
      ['description', input.description],
      ['min_select', input.minSelect],
      ['max_select', input.maxSelect],
    ]);
    if (Object.keys(fields).length > 0 && !(await repo.updateGroup(id, fields))) {
      throw notFound('Grupo no encontrado');
    }
    invalidate();
    return loadGroup(id);
  },

  async createModifier(groupId: string, input: ModifierInput): Promise<AdminModifierGroup> {
    await loadGroup(groupId);
    await repo.createModifier(groupId, {
      name: input.name,
      price_delta: input.priceDelta,
      max_quantity: input.maxQuantity,
      is_default: input.isDefault,
      is_available: input.isAvailable,
      sort_order: input.sortOrder,
    });
    invalidate();
    return loadGroup(groupId);
  },

  async updateModifier(id: string, input: ModifierUpdate) {
    const row = await repo.updateModifier(
      id,
      pick<AdminModifierRow>([
        ['name', input.name],
        ['price_delta', input.priceDelta],
        ['max_quantity', input.maxQuantity],
        ['is_default', input.isDefault],
        ['is_available', input.isAvailable],
        ['sort_order', input.sortOrder],
      ]),
    );
    if (!row) throw notFound('Opcion no encontrada');
    invalidate();
    return toModifier(row);
  },

  // --- Local ---
  async getSettings(): Promise<AdminSettings> {
    return toSettings(await repo.getSettings());
  },

  async updateSettings(input: SettingsUpdate): Promise<AdminSettings> {
    const row = await repo.updateSettings(
      pick<SettingsRow>([
        ['is_open', input.isOpen],
        ['delivery_fee', input.deliveryFee],
        ['min_order_delivery', input.minOrderDelivery],
        ['free_delivery_threshold', input.freeDeliveryThreshold],
        ['eta_min', input.etaMin],
        ['eta_max', input.etaMax],
        ['auto_advance', input.autoAdvance],
      ]),
    );
    invalidate();
    return toSettings(row);
  },
};
