import { rateLimit, type Options } from 'express-rate-limit';
import { AppError } from '../lib/errors';

// Respuesta 429 con el mismo formato de error que el resto de la API.
const handler: Options['handler'] = (_req, _res, next) => {
  next(
    new AppError(429, 'TOO_MANY_REQUESTS', 'Demasiados intentos. Proba de nuevo en unos minutos.'),
  );
};

const base = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
} satisfies Partial<Options>;

// Login / registro: frena fuerza bruta y creacion masiva de cuentas.
// skipSuccessfulRequests: los logins correctos no consumen cupo.
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
});

// Refresh: mas permisivo (el front lo llama al cargar y al vencer el access).
export const refreshLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 60,
});

// Cotizacion del checkout (publica): se llama al editar carrito/cupon.
export const quoteLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 150,
});

// Crear pedidos: por usuario (va despues de authenticate), no por IP.
export const orderLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => `user:${req.user!.id}`,
});
