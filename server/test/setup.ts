import { afterEach, beforeEach, vi } from 'vitest';

// Reemplaza la capa repositories (la unica que habla con Supabase) por la
// base en memoria. Todo lo demas es el codigo real de la app.
vi.mock('../src/repositories/catalog.repository', async () => ({
  catalogRepository: (await import('./fakeDb')).fakeCatalogRepository,
}));
vi.mock('../src/repositories/coupon.repository', async () => ({
  couponRepository: (await import('./fakeDb')).fakeCouponRepository,
}));
vi.mock('../src/repositories/user.repository', async () => ({
  userRepository: (await import('./fakeDb')).fakeUserRepository,
}));
vi.mock('../src/repositories/refreshToken.repository', async () => ({
  refreshTokenRepository: (await import('./fakeDb')).fakeRefreshTokenRepository,
}));
vi.mock('../src/repositories/order.repository', async () => {
  const fake = await import('./fakeDb');
  return { orderRepository: fake.fakeOrderRepository, ACTIVE_STATUSES: fake.ACTIVE_STATUSES };
});
vi.mock('../src/repositories/adminCatalog.repository', async () => ({
  adminCatalogRepository: (await import('./fakeDb')).fakeAdminCatalogRepository,
}));
vi.mock('../src/repositories/storage.repository', async () => ({
  storageRepository: (await import('./fakeDb')).fakeStorageRepository,
}));

beforeEach(async () => {
  const { resetDb } = await import('./fakeDb');
  const { catalogCache } = await import('../src/lib/cache');
  resetDb();
  catalogCache.invalidate();
  // Logs JSON silenciados (los tests pueden espiarlos igual)
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
