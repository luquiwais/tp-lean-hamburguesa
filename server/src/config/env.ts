import { z } from 'zod';

// Valida las variables de entorno al arrancar. Si falta algo obligatorio,
// el proceso termina con un mensaje claro en vez de fallar mas tarde.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SUPABASE_URL: z.url({ protocol: /^https$/ }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Secretos de al menos 32 caracteres (generados con crypto.randomBytes)
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32), // pepper del HMAC de los refresh tokens
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  // 'lax' en local (front y back en el mismo sitio via proxy de Vite).
  // En el deploy Vercel + Render son sitios distintos: usar 'none' (exige HTTPS).
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
