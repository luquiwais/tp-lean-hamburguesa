// "$ 18.400": pesos sin decimales (los montos son enteros en toda la app).
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatARS = (amount: number) => ars.format(amount);
