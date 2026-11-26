import jwt from 'jsonwebtoken';
import { roleSchema, type Role } from '@burger/shared';
import { env } from '../config/env';
import { unauthorized } from './errors';

const ISSUER = 'burger-server';
const AUDIENCE = 'burger-client';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: payload.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

// Verifica firma, vencimiento, issuer y audience. El algoritmo se fija en
// HS256 para evitar ataques de "alg confusion" (ej: alg: none).
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('payload invalido');
    const role = roleSchema.parse(decoded.role);
    return { sub: decoded.sub, role };
  } catch {
    throw unauthorized('Sesion invalida o vencida');
  }
}
