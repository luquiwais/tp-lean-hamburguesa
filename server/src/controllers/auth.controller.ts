import type { CookieOptions, RequestHandler, Response } from 'express';
import type { LoginInput, RegisterInput } from '@burger/shared';
import { env, isProduction } from '../config/env';
import { REFRESH_TOKEN_RE } from '../lib/refreshToken';
import { unauthorized } from '../lib/errors';
import { authService, type AuthResult } from '../services/auth.service';

export const REFRESH_COOKIE = 'rt';

// La cookie solo viaja a /api/auth (no a cada request de la API) y JS no
// puede leerla (httpOnly). En produccion siempre Secure.
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: isProduction || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
};

function sendAuth(res: Response, result: AuthResult, status = 200) {
  res
    .cookie(REFRESH_COOKIE, result.refreshToken, {
      ...cookieBase,
      expires: result.refreshExpiresAt,
    })
    .set('Cache-Control', 'no-store')
    .status(status)
    .json(result.body);
}

// Lee la cookie y descarta de entrada cualquier valor con formato invalido.
function readRefreshCookie(cookies: Record<string, unknown>): string | undefined {
  const raw = cookies[REFRESH_COOKIE];
  return typeof raw === 'string' && REFRESH_TOKEN_RE.test(raw) ? raw : undefined;
}

export const authController = {
  register: (async (req, res) => {
    const result = await authService.register(req.valid.body as RegisterInput);
    sendAuth(res, result, 201);
  }) satisfies RequestHandler,

  login: (async (req, res) => {
    const result = await authService.login(req.valid.body as LoginInput);
    sendAuth(res, result);
  }) satisfies RequestHandler,

  refresh: (async (req, res) => {
    const token = readRefreshCookie(req.cookies);
    if (!token) throw unauthorized('Sesion invalida o vencida');
    try {
      sendAuth(res, await authService.refresh(token, req.log));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieBase); // cookie inservible: borrarla
      throw err;
    }
  }) satisfies RequestHandler,

  logout: (async (req, res) => {
    await authService.logout(readRefreshCookie(req.cookies));
    res.clearCookie(REFRESH_COOKIE, cookieBase).status(204).end();
  }) satisfies RequestHandler,

  me: (async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await authService.me(req.user!.id));
  }) satisfies RequestHandler,
};
