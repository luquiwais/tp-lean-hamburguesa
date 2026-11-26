import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Role } from '@burger/shared';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/lib/jwt';
import { db, IDS } from './fakeDb';

export const app = createApp();
export const api = () => request(app);

// Crea un usuario directo en la base falsa y devuelve un access token
// valido (sin pasar por bcrypt: para tests que no son de auth).
export function createUser(role: Role = 'customer') {
  const id = randomUUID();
  db.users.set(id, {
    id,
    email: `${role}-${id.slice(0, 8)}@test.com`,
    name: role === 'admin' ? 'Admin' : 'Cliente',
    phone: null,
    role,
    password_hash: 'no-usado',
  });
  const token = signAccessToken({ sub: id, role });
  return { id, token, auth: `Bearer ${token}` };
}

// Clasica con pan de papa (+500) y 2 bacon (+3000) = $12.500 c/u
export const clasicaCompleta = (quantity = 1) => ({
  productId: IDS.clasica,
  quantity,
  selections: [
    { modifierId: IDS.panPapa, quantity: 1 },
    { modifierId: IDS.bacon, quantity: 2 },
  ],
});

export const validCard = {
  method: 'card' as const,
  cardNumber: '4242 4242 4242 4242',
  holderName: 'Ana Test',
  expMonth: 12,
  expYear: 99,
  cvv: '123',
};

export function orderBody(overrides: Record<string, unknown> = {}) {
  return {
    fulfillment: 'pickup',
    items: [clasicaCompleta(1)],
    contact: { name: 'Ana Test', phone: '11 5555-5555' },
    payment: validCard,
    ...overrides,
  };
}

// Extrae el valor de la cookie "rt" de un Set-Cookie.
export function refreshCookie(res: { headers: Record<string, unknown> }): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : [];
  const rt = list.find((c) => c.startsWith('rt='));
  return rt?.split(';')[0];
}
