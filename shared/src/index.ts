// Punto de entrada del paquete compartido.
// Cada dominio (catalog, orders, auth, coupons) tiene su propio archivo de schemas.
export * from './schemas/common';
export * from './schemas/health';
export * from './schemas/catalog';
export * from './schemas/auth';
export * from './schemas/orders';
export * from './pricing';
export * from './orderTotals';
export * from './payments';
export * from './schemas/admin';
export * from './slug';
