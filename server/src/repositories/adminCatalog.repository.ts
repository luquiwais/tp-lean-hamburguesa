import { supabase } from '../lib/supabase';
import { conflict } from '../lib/errors';

// Escrituras del catalogo para el panel admin (lee tambien lo inactivo).

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface AdminProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  image_url: string | null;
  type: 'simple' | 'combo';
  badges: string[];
  sort_order: number;
  is_available: boolean;
  is_active: boolean;
  product_modifier_groups: { group_id: string; sort_order: number }[];
}

export interface AdminModifierRow {
  id: string;
  name: string;
  price_delta: number;
  max_quantity: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

export interface AdminGroupRow {
  id: string;
  code: string;
  name: string;
  description: string;
  min_select: number;
  max_select: number;
  modifiers: AdminModifierRow[];
  product_modifier_groups: { count: number }[];
}

export interface SettingsRow {
  is_open: boolean;
  delivery_fee: number;
  min_order_delivery: number;
  free_delivery_threshold: number | null;
  eta_min: number;
  eta_max: number;
  auto_advance: boolean;
}

const CATEGORY_FIELDS = 'id, name, slug, sort_order, is_active';
const PRODUCT_FIELDS = `id, category_id, name, slug, description, base_price, image_url, type,
  badges, sort_order, is_available, is_active, product_modifier_groups ( group_id, sort_order )`;
const GROUP_FIELDS = `id, code, name, description, min_select, max_select,
  modifiers ( id, name, price_delta, max_quantity, is_default, is_available, sort_order ),
  product_modifier_groups ( count )`;
const MODIFIER_FIELDS = 'id, name, price_delta, max_quantity, is_default, is_available, sort_order';
const SETTINGS_FIELDS =
  'is_open, delivery_fee, min_order_delivery, free_delivery_threshold, eta_min, eta_max, auto_advance';

// Traduce errores de Postgres a errores de negocio (nunca se expone el SQL).
function rethrow(error: { code?: string; message: string }, what: string): never {
  if (error.code === '23505') throw conflict(`Ya existe ${what} con ese nombre o slug`);
  if (error.code === '23503') throw conflict(`La referencia de ${what} no existe`);
  throw error;
}

export const adminCatalogRepository = {
  // --- Categorias ---
  async listCategories(): Promise<AdminCategoryRow[]> {
    const { data, error } = await supabase
      .from('categories')
      .select(CATEGORY_FIELDS)
      .order('sort_order');
    if (error) throw error;
    return data;
  },

  async createCategory(row: Omit<AdminCategoryRow, 'id'>): Promise<AdminCategoryRow> {
    const { data, error } = await supabase
      .from('categories')
      .insert(row)
      .select(CATEGORY_FIELDS)
      .single();
    if (error) rethrow(error, 'una categoria');
    return data;
  },

  async updateCategory(
    id: string,
    fields: Partial<Omit<AdminCategoryRow, 'id'>>,
  ): Promise<AdminCategoryRow | null> {
    const { data, error } = await supabase
      .from('categories')
      .update(fields)
      .eq('id', id)
      .select(CATEGORY_FIELDS)
      .maybeSingle();
    if (error) rethrow(error, 'una categoria');
    return data;
  },

  // --- Productos ---
  async listProducts(): Promise<AdminProductRow[]> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FIELDS)
      .order('sort_order')
      .returns<AdminProductRow[]>();
    if (error) throw error;
    return data;
  },

  async findProduct(id: string): Promise<AdminProductRow | null> {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('id', id)
      .maybeSingle<AdminProductRow>();
    if (error) throw error;
    return data;
  },

  async createProduct(
    row: Omit<AdminProductRow, 'id' | 'image_url' | 'is_active' | 'product_modifier_groups'>,
  ): Promise<string> {
    const { data, error } = await supabase.from('products').insert(row).select('id').single();
    if (error) rethrow(error, 'un producto');
    return data.id;
  },

  async updateProduct(
    id: string,
    fields: Partial<Omit<AdminProductRow, 'id' | 'product_modifier_groups'>>,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('products')
      .update(fields)
      .eq('id', id)
      .select('id');
    if (error) rethrow(error, 'un producto');
    return data.length > 0;
  },

  // Reemplaza los grupos del producto respetando el orden recibido.
  async setProductGroups(productId: string, groupIds: string[]): Promise<void> {
    const del = await supabase.from('product_modifier_groups').delete().eq('product_id', productId);
    if (del.error) throw del.error;
    if (groupIds.length === 0) return;
    const { error } = await supabase.from('product_modifier_groups').insert(
      groupIds.map((groupId, index) => ({
        product_id: productId,
        group_id: groupId,
        sort_order: index + 1,
      })),
    );
    if (error) rethrow(error, 'un grupo de modificadores');
  },

  // --- Grupos de modificadores ---
  async listGroups(): Promise<AdminGroupRow[]> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .select(GROUP_FIELDS)
      .order('name')
      .returns<AdminGroupRow[]>();
    if (error) throw error;
    return data;
  },

  async findGroup(id: string): Promise<AdminGroupRow | null> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .select(GROUP_FIELDS)
      .eq('id', id)
      .maybeSingle<AdminGroupRow>();
    if (error) throw error;
    return data;
  },

  async createGroup(row: {
    code: string;
    name: string;
    description: string;
    min_select: number;
    max_select: number;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .insert(row)
      .select('id')
      .single();
    if (error) rethrow(error, 'un grupo');
    return data.id;
  },

  async updateGroup(
    id: string,
    fields: Partial<{ name: string; description: string; min_select: number; max_select: number }>,
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('modifier_groups')
      .update(fields)
      .eq('id', id)
      .select('id');
    if (error) {
      // 23514 = check_violation (min_select <= max_select)
      if (error.code === '23514') throw conflict('El minimo no puede superar al maximo');
      rethrow(error, 'un grupo');
    }
    return data.length > 0;
  },

  async createModifier(
    groupId: string,
    row: Omit<AdminModifierRow, 'id'>,
  ): Promise<AdminModifierRow> {
    const { data, error } = await supabase
      .from('modifiers')
      .insert({ ...row, group_id: groupId })
      .select(MODIFIER_FIELDS)
      .single();
    if (error) rethrow(error, 'una opcion');
    return data;
  },

  async updateModifier(
    id: string,
    fields: Partial<Omit<AdminModifierRow, 'id'>>,
  ): Promise<AdminModifierRow | null> {
    const { data, error } = await supabase
      .from('modifiers')
      .update(fields)
      .eq('id', id)
      .select(MODIFIER_FIELDS)
      .maybeSingle();
    if (error) rethrow(error, 'una opcion');
    return data;
  },

  // --- Configuracion del local ---
  async getSettings(): Promise<SettingsRow> {
    const { data, error } = await supabase
      .from('store_settings')
      .select(SETTINGS_FIELDS)
      .eq('id', 1)
      .single();
    if (error) throw error;
    return data;
  },

  async updateSettings(fields: Partial<SettingsRow>): Promise<SettingsRow> {
    const { data, error } = await supabase
      .from('store_settings')
      .update(fields)
      .eq('id', 1)
      .select(SETTINGS_FIELDS)
      .single();
    if (error) {
      if (error.code === '23514') throw conflict('El tiempo minimo no puede superar al maximo');
      throw error;
    }
    return data;
  },
};
