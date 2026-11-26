import { nextStatusesFor } from '@burger/shared';
import type { Logger } from '../logger';
import { adminCatalogRepository } from '../repositories/adminCatalog.repository';
import { orderRepository } from '../repositories/order.repository';

// Avance automatico de estados para la DEMO: si store_settings.auto_advance
// esta activo, cada `intervalMs` los pedidos activos que llevan mas de
// `intervalMs` sin cambios avanzan un paso. Usa change_order_status
// (concurrencia optimista), asi que nunca pisa un cambio manual del admin.
export function startAutoAdvance(log: Logger, intervalMs = 45_000): () => void {
  let running = false;

  const tick = async () => {
    if (running) return; // no solapar ticks si la DB tarda
    running = true;
    try {
      const settings = await adminCatalogRepository.getSettings();
      if (!settings.auto_advance) return;

      const stale = await orderRepository.listStaleActive(new Date(Date.now() - intervalMs));
      for (const order of stale) {
        const next = nextStatusesFor(order.status, order.fulfillment).find(
          (s) => s !== 'cancelled' && s !== 'rejected',
        );
        if (!next) continue;
        const applied = await orderRepository.changeStatus({
          orderId: order.id,
          from: order.status,
          to: next,
          changedBy: null, // null = sistema
          note: 'Avance automatico (demo)',
        });
        if (applied) {
          log.info('order_auto_advanced', { order_id: order.id, from: order.status, to: next });
        }
      }
    } catch (err) {
      log.error('auto_advance_failed', { err });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  timer.unref(); // no impide que el proceso termine
  return () => clearInterval(timer);
}
