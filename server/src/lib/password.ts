import bcrypt from 'bcryptjs';

const COST = 12;

// Hash precomputado que se usa cuando el email no existe: asi el login
// tarda lo mismo exista o no el usuario (evita enumerar emails por tiempo).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-para-igualar-tiempos', COST);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && hash !== null);
}
