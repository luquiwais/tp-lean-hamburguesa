import type { OrderStatus } from '@burger/shared';
import { supabase } from '../lib/supabase';
import { conflict } from '../lib/errors';

// Payloads de la funcion create_order (snake_case, como la DB).
export interface CreateOrderPayload {
  user_id: string;
  fulfillment: 'delivery' | 'pickup';
  customer_name: string;
  customer_phone: string;
  address_snapshot: Record<string, string | null> | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_id: string | null;
  coupon_code: string | null;
  payment_method: 'cash' | 'card';
  payment_brand: string | null;
  payment_last4: string | null;
  cash_amount: number | null;
  notes: string | null;
}

export interface CreateOrderItemPayload {
  product_id: string;
  product_name: string;
  unit_base_price: number;
  quantity: number;
  item_total: number;
  notes: string | null;
  modifiers: {
    modifier_id: string;
    group_name: string;
    modifier_name: string;
    price_delta: number;
    quantity: number;
  }[];
}

export interface OrderRow {
  id: string;
  order_number: number;
  user_id: string | null;
  status: OrderStatus;
  fulfillment: 'delivery' | 'pickup';
  customer_name: string;
  customer_phone: string;
  address_snapshot: Record<string, string | null> | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  payment_method: 'cash' | 'card';
  payment_brand: string | null;
  payment_last4: string | null;
  cash_amount: number | null;
  notes: string | null;
  created_at: string;
  order_items: {
    id: string;
    product_id: string | null;
    product_name: string;
    unit_base_price: number;
    quantity: number;
    item_total: number;
    notes: string | null;
    order_item_modifiers: {
      group_name: string;
      modifier_name: string;
      price_delta: number;
      quantity: number;
    }[];
  }[];
  order_status_history: { status: OrderStatus; changed_at: string; note: string | null }[];
}

export interface OrderListRow {
  id: string;
  order_number: number;
  status: OrderStatus;
  fulfillment: 'delivery' | 'pickup';
  total: number;
  created_at: string;
  order_items: { quantity: number }[];
}

const DETAIL_SELECT = `
  id, order_number, user_id, status, fulfillment, customer_name, customer_phone,
  address_snapshot, subtotal, delivery_fee, discount, total, coupon_code,
  payment_method, payment_brand, payment_last4, cash_amount, notes, created_at,
  order_items (
    id, product_id, product_name, unit_base_price, quantity, item_total, notes,
    order_item_modifiers ( group_name, modifier_name, price_delta, quantity )
  ),
  order_status_history ( status, changed_at, note )`;

const LIST_SELECT =
  'id, order_number, status, fulfillment, total, created_at, order_items ( quantity )';

export const ACTIVE_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'on_the_way',
  'ready_for_pickup',
];

export interface AdminOrderListRow extends OrderListRow {
  customer_name: string;
  updated_at: string;
}

export interface DashboardOrderRow {
  status: OrderStatus;
  fulfillment: 'delivery' | 'pickup';
  total: number;
  created_at: string;
  order_items: { product_name: string; quantity: number; item_total: number }[];
}

export const orderRepository = {
  async listAdmin(filters: {
    status?: OrderStatus;
    active?: boolean;
    page: number;
    pageSize: number;
  }): Promise<{ rows: AdminOrderListRow[]; total: number }> {
    const from = (filters.page - 1) * filters.pageSize;
    let query = supabase
      .from('orders')
      .select(
        'id, order_number, status, fulfillment, customer_name, total, created_at, updated_at, order_items ( quantity )',
        { count: 'exact' },
      )
      .order('created_at', { ascending: filters.active === true }) // cocina: los mas viejos primero
      .range(from, from + filters.pageSize - 1);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.active) query = query.in('status', ACTIVE_STATUSES);

    const { data, error, count } = await query.returns<AdminOrderListRow[]>();
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  },

  // Pedidos activos sin cambios desde `before` (para el auto-avance de la demo).
  async listStaleActive(
    before: Date,
    limit = 50,
  ): Promise<{ id: string; status: OrderStatus; fulfillment: 'delivery' | 'pickup' }[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, fulfillment')
      .in('status', ACTIVE_STATUSES)
      .lt('updated_at', before.toISOString())
      .order('updated_at')
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async listSince(since: Date): Promise<DashboardOrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(
        'status, fulfillment, total, created_at, order_items ( product_name, quantity, item_total )',
      )
      .gte('created_at', since.toISOString())
      .returns<DashboardOrderRow[]>();
    if (error) throw error;
    return data;
  },

  async countByStatus(statuses: OrderStatus[]): Promise<number> {
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', statuses);
    if (error) throw error;
    return count ?? 0;
  },

  // Escritura atomica (pedido + items + modificadores + historial + cupon).
  async create(
    order: CreateOrderPayload,
    items: CreateOrderItemPayload[],
  ): Promise<{ id: string; order_number: number }> {
    const { data, error } = await supabase.rpc('create_order', { p_order: order, p_items: items });
    if (error) {
      // El cupon se agoto/vencio entre la cotizacion y la confirmacion
      if (error.message.includes('COUPON_UNAVAILABLE')) {
        throw conflict('El cupon ya no esta disponible. Sacalo y volve a confirmar.');
      }
      throw error;
    }
    return data as { id: string; order_number: number };
  },

  async findById(id: string): Promise<OrderRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .order('changed_at', { referencedTable: 'order_status_history' })
      .maybeSingle<OrderRow>();
    if (error) throw error;
    return data;
  },

  async listByUser(userId: string, limit = 50): Promise<OrderListRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(LIST_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<OrderListRow[]>();
    if (error) throw error;
    return data;
  },

  // Devuelve false si el pedido ya no estaba en `from` (otro lo cambio antes).
  async changeStatus(input: {
    orderId: string;
    from: OrderStatus;
    to: OrderStatus;
    changedBy: string | null;
    note?: string;
  }): Promise<boolean> {
    const { data, error } = await supabase.rpc('change_order_status', {
      p_order_id: input.orderId,
      p_from: input.from,
      p_to: input.to,
      p_changed_by: input.changedBy,
      p_note: input.note ?? null,
    });
    if (error) throw error;
    return data === true;
  },
};
