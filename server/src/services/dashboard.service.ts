import type { Dashboard } from '@burger/shared';
import { ACTIVE_STATUSES, orderRepository } from '../repositories/order.repository';

const TZ = 'America/Argentina/Buenos_Aires';
const DAY = 86_400_000;

// Fecha local de Argentina (YYYY-MM-DD) para agrupar por dia.
const localDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });

const bucket = (rows: { total: number }[]) => {
  const revenue = rows.reduce((s, r) => s + r.total, 0);
  return {
    orders: rows.length,
    revenue,
    averageTicket: rows.length ? Math.round(revenue / rows.length) : 0,
  };
};

// Metricas de los ultimos 30 dias. Los pedidos cancelados o rechazados no
// suman ventas (pero si aparecen en el conteo por estado).
export const dashboardService = {
  async get(): Promise<Dashboard> {
    const now = new Date();
    const [rows, activeOrders] = await Promise.all([
      orderRepository.listSince(new Date(now.getTime() - 30 * DAY)),
      orderRepository.countByStatus(ACTIVE_STATUSES),
    ]);

    const valid = rows.filter((r) => r.status !== 'cancelled' && r.status !== 'rejected');
    const today = localDate(now);
    const weekAgo = now.getTime() - 7 * DAY;

    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    const products = new Map<string, { quantity: number; revenue: number }>();
    for (const r of valid) {
      for (const item of r.order_items) {
        const p = products.get(item.product_name) ?? { quantity: 0, revenue: 0 };
        p.quantity += item.quantity;
        p.revenue += item.item_total;
        products.set(item.product_name, p);
      }
    }

    // Ultimos 7 dias, incluyendo los dias sin ventas (para el grafico)
    const salesByDay = Array.from({ length: 7 }, (_, i) => {
      const date = localDate(new Date(now.getTime() - (6 - i) * DAY));
      const dayRows = valid.filter((r) => localDate(new Date(r.created_at)) === date);
      return { date, revenue: bucket(dayRows).revenue, orders: dayRows.length };
    });

    return {
      today: bucket(valid.filter((r) => localDate(new Date(r.created_at)) === today)),
      last7Days: bucket(valid.filter((r) => new Date(r.created_at).getTime() >= weekAgo)),
      last30Days: bucket(valid),
      activeOrders,
      byStatus,
      byFulfillment: {
        delivery: valid.filter((r) => r.fulfillment === 'delivery').length,
        pickup: valid.filter((r) => r.fulfillment === 'pickup').length,
      },
      topProducts: [...products.entries()]
        .map(([productName, p]) => ({ productName, ...p }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      salesByDay,
    };
  },
};
