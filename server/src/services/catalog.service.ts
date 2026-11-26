import {
  BADGES,
  type Badge,
  type MenuResponse,
  type ModifierGroup,
  type ProductDetail,
  type ProductSummary,
  type StoreInfo,
} from '@burger/shared';
import { catalogCache } from '../lib/cache';
import { notFound } from '../lib/errors';
import {
  catalogRepository,
  type ProductDetailRow,
  type ProductRow,
  type StoreSettingsRow,
} from '../repositories/catalog.repository';

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) =>
  a.sort_order - b.sort_order;

const toBadges = (raw: string[]): Badge[] =>
  raw.filter((b): b is Badge => (BADGES as readonly string[]).includes(b));

function toStoreInfo(row: StoreSettingsRow): StoreInfo {
  return {
    isOpen: row.is_open,
    deliveryFee: row.delivery_fee,
    minOrderDelivery: row.min_order_delivery,
    freeDeliveryThreshold: row.free_delivery_threshold,
    etaMin: row.eta_min,
    etaMax: row.eta_max,
  };
}

function toSummary(
  row: Omit<ProductRow, 'product_modifier_groups'>,
  hasRequired: boolean,
): ProductSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    basePrice: row.base_price,
    imageUrl: row.image_url,
    type: row.type,
    badges: toBadges(row.badges),
    isAvailable: row.is_available,
    hasRequiredModifiers: hasRequired,
  };
}

function toModifierGroups(row: ProductDetailRow): ModifierGroup[] {
  return row.product_modifier_groups
    .filter((pmg) => pmg.modifier_groups !== null)
    .sort(bySortOrder)
    .map(({ modifier_groups: g }) => {
      const group = g!;
      return {
        id: group.id,
        code: group.code,
        name: group.name,
        description: group.description,
        minSelect: group.min_select,
        maxSelect: group.max_select,
        isRequired: group.min_select > 0,
        modifiers: [...group.modifiers].sort(bySortOrder).map((m) => ({
          id: m.id,
          name: m.name,
          priceDelta: m.price_delta,
          maxQuantity: m.max_quantity,
          isDefault: m.is_default,
          isAvailable: m.is_available,
        })),
      };
    });
}

export const catalogService = {
  // Menu completo en una sola respuesta: datos del local + categorias con
  // sus productos. Las 3 consultas van en paralelo y el resultado se cachea.
  getMenu(): Promise<MenuResponse> {
    return catalogCache.getOrFetch('menu', async () => {
      const [settings, categories, products] = await Promise.all([
        catalogRepository.getStoreSettings(),
        catalogRepository.listActiveCategories(),
        catalogRepository.listActiveProducts(),
      ]);

      return {
        store: toStoreInfo(settings),
        categories: categories
          .map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            products: products
              .filter((p) => p.category_id === c.id)
              .map(({ product_modifier_groups, ...p }) =>
                toSummary(
                  p,
                  product_modifier_groups.some((pmg) => (pmg.modifier_groups?.min_select ?? 0) > 0),
                ),
              ),
          }))
          .filter((c) => c.products.length > 0),
      };
    });
  },

  async getProductBySlug(slug: string): Promise<ProductDetail> {
    const row = await catalogCache.getOrFetch(`product:${slug}`, () =>
      catalogRepository.findActiveProductBySlug(slug),
    );
    // Producto inexistente, dado de baja o de una categoria inactiva
    if (!row || !row.categories?.is_active) throw notFound('Producto no encontrado');

    const groups = toModifierGroups(row);
    const { product_modifier_groups: _pmg, categories, ...base } = row;
    return {
      ...toSummary(
        base,
        groups.some((g) => g.isRequired),
      ),
      categorySlug: categories.slug,
      modifierGroups: groups,
    };
  },
};
