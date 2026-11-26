import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { authResponseSchema } from '@burger/shared';
import { db } from './fakeDb';
import { api, createUser, refreshCookie } from './helpers';

const newUser = { email: 'ana@test.com', password: 'secreta123', name: 'Ana' };

async function register(body: Record<string, unknown> = newUser) {
  return api().post('/api/auth/register').send(body);
}

describe('POST /api/auth/register', () => {
  it('crea la cuenta, devuelve el access token y deja el refresh en una cookie httpOnly', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(authResponseSchema.parse(res.body).user).toMatchObject({
      email: 'ana@test.com',
      role: 'customer',
    });
    expect(res.headers['cache-control']).toBe('no-store');

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('rt='),
    )!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Nunca se devuelve ni se guarda la contrasena en claro
    expect(JSON.stringify(res.body)).not.toContain('secreta123');
    const stored = [...db.users.values()][0]!;
    expect(stored.password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('ignora un "role" en el body: siempre crea customers', async () => {
    const res = await register({ ...newUser, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('customer');
  });

  it('normaliza el email y rechaza duplicados con 409', async () => {
    await register();
    const res = await register({ ...newUser, email: '  ANA@Test.com ' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('valida el body: email y contrasena invalidos dan 400 con detalles', async () => {
    const res = await register({ email: 'no-es-email', password: '123', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(db.users.size).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  it('loguea con credenciales correctas', async () => {
    await register();
    const res = await api().post('/api/auth/login').send({
      email: 'ana@test.com',
      password: 'secreta123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeDefined();
  });

  it('da el mismo 401 si la contrasena esta mal o si el email no existe', async () => {
    await register();
    const wrongPass = await api()
      .post('/api/auth/login')
      .send({ email: 'ana@test.com', password: 'otra-cosa' });
    const noUser = await api()
      .post('/api/auth/login')
      .send({ email: 'nadie@test.com', password: 'secreta123' });

    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    // No se revela si el email esta registrado
    expect(wrongPass.body.error.message).toBe(noUser.body.error.message);
  });
});

describe('GET /api/auth/me y tokens adulterados', () => {
  it('devuelve el usuario del token', async () => {
    const reg = await register();
    const res = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('ana@test.com');
  });

  it('sin token: 401', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
  });

  it('token firmado con otro secreto (intentando ser admin): 401', async () => {
    const { id } = createUser();
    const forged = jwt.sign({ role: 'admin' }, 'un-secreto-que-no-es-el-del-server-123456', {
      subject: id,
      issuer: 'burger-server',
      audience: 'burger-client',
    });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('token con alg "none": 401', async () => {
    const { id } = createUser();
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: id,
      role: 'admin',
      iss: 'burger-server',
      aud: 'burger-client',
      exp: Math.floor(Date.now() / 1000) + 600,
    })}.`;
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });

  it('token valido al que se le cambio el payload: 401', async () => {
    const { token } = createUser();
    const [header, , signature] = token.split('.');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'otro', role: 'admin', iss: 'burger-server', aud: 'burger-client' }),
    ).toString('base64url');
    const res = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${header}.${payload}.${signature}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh (rotacion)', () => {
  it('sin cookie: 401', async () => {
    expect((await api().post('/api/auth/refresh')).status).toBe(401);
  });

  it('rota el refresh token: entrega uno nuevo y un access token valido', async () => {
    const first = refreshCookie(await register())!;
    const res = await api().post('/api/auth/refresh').set('Cookie', first);

    expect(res.status).toBe(200);
    const second = refreshCookie(res)!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    const me = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('detecta el reuso de un token ya rotado y revoca toda la sesion', async () => {
    const first = refreshCookie(await register())!;
    const second = refreshCookie(await api().post('/api/auth/refresh').set('Cookie', first))!;

    // Alguien reusa el token viejo (posible robo)
    const reuse = await api().post('/api/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);

    // ...y el token legitimo tambien queda invalidado (toda la familia)
    const after = await api().post('/api/auth/refresh').set('Cookie', second);
    expect(after.status).toBe(401);
    expect([...db.refreshTokens.values()].every((t) => t.revoked_at !== null)).toBe(true);
  });

  it('una cookie con formato invalido se descarta sin tocar la DB', async () => {
    const res = await api().post('/api/auth/refresh').set('Cookie', "rt=' OR 1=1 --");
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revoca la sesion: el refresh token deja de servir', async () => {
    const cookie = refreshCookie(await register())!;
    const out = await api().post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);

    const res = await api().post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('bloquea con 429 despues de 10 logins fallidos desde la misma IP', async () => {
    const ip = '203.0.113.7'; // IP propia para no afectar a los demas tests
    const attempt = () =>
      api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ email: 'nadie@test.com', password: 'fuerza-bruta' });

    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  }, 30_000); // cada intento corre bcrypt (costo 12) a proposito
});
