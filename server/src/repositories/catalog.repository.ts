import { supabase } from '../lib/supabase';

// Filas tal como vienen de la DB (snake_case). El service las convierte
// al contrato publico de @burger/shared.

export interface StoreSettingsRow {
  is_open: boolean;
  delivery_fee: number;
  min_order_delivery: number;
  free_delivery_threshold: number | null;
  eta_min: number;
  eta_max: number;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}

interface ModifierGroupRefRow {
  modifier_groups: { min_select: number } | null;
}

export interface ProductRow {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: string;
  base_price: number;
  image_url: string | null;
  type: 'simple' | 'combo';
  badges: string[];
  sort_order: number;
  is_available: boolean;
  product_modifier_groups: ModifierGroupRefRow[];
}

export interface ModifierRow {
  id: string;
  name: string;
  price_delta: number;
  max_quantity: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface ProductDetailRow extends Omit<ProductRow, 'product_modifier_groups'> {
  categories: { slug: string; is_active: boolean } | null;
  product_modifier_groups: {
    sort_order: number;
    modifier_groups: {
      id: string;
      code: string;
      name: string;
      description: string;
      min_select: number;
      max_select: number;
      modifiers: ModifierRow[];
    } | null;
  }[];
}

const PRODUCT_FIELDS =
  'id, category_id, slug, name, description, base_price, image_url, type, badges, sort_order, is_available';

export const catalogRepository = {
  async getStoreSettings(): Promise<StoreSettingsRow> {
    const { data, error } = await supabase
      .from('store_settings')
      .select(
        'is_open, delivery_fee, min_order_delivery, free_delivery_threshold, eta_min, eta_max',
      )
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data;
  },

  async listActiveCategories(): Promise<CategoryRow[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('id, slug, name, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  },

  // Productos activos con el min_select de sus grupos (para calcular
  // hasRequiredModifiers sin traer todos los modificadores).
  async listActiveProducts(): Promise<ProductRow[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_FIELDS}, product_modifier_groups ( modifier_groups ( min_select ) )`)
      .eq('is_active', true)
      .order('sort_order')
      .returns<ProductRow[]>();
    if (error) throw error;
    return data;
  },

  async findActiveProductBySlug(slug: string): Promise<ProductDetailRow | null> {
    const { data, error } = await supabase
      .from('products')
      .select(
        `${PRODUCT_FIELDS},
         categories ( slug, is_active ),
         product_modifier_groups (
           sort_order,
           modifier_groups (
             id, code, name, description, min_select, max_select,
             modifiers ( id, name, price_delta, max_quantity, is_default, is_available, sort_order )
           )
         )`,
      )
      .eq('slug', slug) // supabase-js parametriza: no hay concatenacion de SQL
      .eq('is_active', true)
      .returns<ProductDetailRow[]>()
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
