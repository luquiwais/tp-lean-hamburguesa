const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// Montos en mensajes de error para el usuario ("Te faltan $ 3.000...").
export const formatARS = (amount: number) => ars.format(amount);
