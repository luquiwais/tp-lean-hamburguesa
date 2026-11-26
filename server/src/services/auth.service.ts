import { randomUUID } from 'node:crypto';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@burger/shared';
import { env } from '../config/env';
import { conflict, unauthorized } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateRefreshToken, hashRefreshToken, safeEqualHex } from '../lib/refreshToken';
import type { Logger } from '../logger';
import { refreshTokenRepository } from '../repositories/refreshToken.repository';
import { userRepository, type UserRow } from '../repositories/user.repository';

// Resultado interno: el controller pone refreshToken en la cookie y
// devuelve el resto en el body.
export interface AuthResult {
  body: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const SESSION_INVALID = 'Sesion invalida o vencida';

const toAuthUser = (u: UserRow): AuthUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  role: u.role,
});

// Emite access token + un refresh token nuevo. familyId identifica la
// "sesion": se mantiene en cada rotacion y se crea uno nuevo en cada login.
async function issueTokens(
  user: UserRow,
  familyId: string = randomUUID(),
): Promise<AuthResult & { refreshId: string }> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const row = await refreshTokenRepository.create({
    userId: user.id,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshExpiresAt,
  });

  return {
    body: {
      accessToken: signAccessToken({ sub: user.id, role: user.role }),
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: toAuthUser(user),
    },
    refreshToken,
    refreshExpiresAt,
    refreshId: row.id,
  };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await userRepository.findByEmailWithHash(input.email);
    if (existing) throw conflict('Ya existe una cuenta con ese email');

    // El rol SIEMPRE es customer: nunca se toma del body.
    const user = await userRepository.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      phone: input.phone ?? null,
    });
    return issueTokens(user);
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithHash(input.email);
    // Siempre se corre bcrypt (con hash falso si no existe) y el mensaje es
    // el mismo en ambos casos: no se revela si el email esta registrado.
    const ok = await verifyPassword(input.password, user?.password_hash ?? null);
    if (!user || !ok) throw unauthorized('Email o contrasena incorrectos');

    const { password_hash: _hash, ...publicUser } = user;
    return issueTokens(publicUser);
  },

  // Rotacion: cada refresh invalida el token usado y entrega uno nuevo.
  // Si llega un token YA revocado, alguien lo esta reusando (posible robo):
  // se revoca toda la familia y ambos (atacante y victima) deben re-loguear.
  async refresh(rawToken: string, log: Logger): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const row = await refreshTokenRepository.findByHash(tokenHash);
    if (!row || !safeEqualHex(row.token_hash, tokenHash)) throw unauthorized(SESSION_INVALID);

    if (row.revoked_at) {
      log.warn('refresh_token_reuse_detected', { user_id: row.user_id, family_id: row.family_id });
      await refreshTokenRepository.revokeFamily(row.family_id);
      throw unauthorized(SESSION_INVALID);
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) throw unauthorized(SESSION_INVALID);

    const user = await userRepository.findById(row.user_id);
    if (!user) throw unauthorized(SESSION_INVALID);

    const next = await issueTokens(user, row.family_id);
    const rotated = await refreshTokenRepository.revokeIfActive(row.id, next.refreshId);
    if (!rotated) {
      // Otro request uso el mismo token en paralelo: tratar como reuso.
      log.warn('refresh_token_race_detected', { user_id: row.user_id, family_id: row.family_id });
      await refreshTokenRepository.revokeFamily(row.family_id);
      throw unauthorized(SESSION_INVALID);
    }
    return next;
  },

  // Cierra la sesion actual (toda la familia del token). Idempotente.
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const row = await refreshTokenRepository.findByHash(hashRefreshToken(rawToken));
    if (row) await refreshTokenRepository.revokeFamily(row.family_id);
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw unauthorized(SESSION_INVALID);
    return toAuthUser(user);
  },
};
