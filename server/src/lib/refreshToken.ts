import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

// El refresh token es un valor opaco y aleatorio (no un JWT). En la DB se
// guarda solo su HMAC-SHA256 con un pepper secreto: si se filtra la tabla,
// los hashes no sirven para nada sin el secreto del server.

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

// Comparacion en tiempo constante (nunca === para secretos).
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Formato esperado del token que llega en la cookie (base64url de 48 bytes = 64 chars).
export const REFRESH_TOKEN_RE = /^[A-Za-z0-9_-]{64}$/;
