import { z } from 'zod';

// Valida las variables de entorno al arrancar. Si falta algo obligatorio,
// el proceso termina con un mensaje claro en vez de fallar mas tarde.
// Las de Supabase y JWT son opcionales por ahora; pasan a obligatorias en Fase 1 y 3.
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
  SUPABASE_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
