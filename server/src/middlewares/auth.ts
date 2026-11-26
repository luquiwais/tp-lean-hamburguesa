import type { RequestHandler } from 'express';
import type { Role } from '@burger/shared';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';

// authenticate: exige "Authorization: Bearer <accessToken>" valido.
// La identidad (req.user) sale SIEMPRE del JWT verificado, nunca del body.
export const authenticate: RequestHandler = (req, _res, next) => {
  const match = req.header('authorization')?.match(/^Bearer ([A-Za-z0-9._-]{20,2048})$/);
  if (!match?.[1]) return next(unauthorized('Necesitas iniciar sesion'));

  const payload = verifyAccessToken(match[1]);
  req.user = { id: payload.sub, role: payload.role };
  req.log = req.log.child({ user_id: payload.sub });
  next();
};

// authorize: usar despues de authenticate. 403 si el rol no esta permitido.
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized('Necesitas iniciar sesion'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
