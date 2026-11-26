import { defineConfig } from 'vitest/config';

// Dos proyectos:
// - shared: logica pura (precios, totales, pagos, transiciones).
// - server: tests de la API con Supertest sobre la app real de Express. Los
//   repositories se reemplazan por una base en memoria (server/test/fakeDb.ts),
//   asi que no se toca Supabase y corren igual en local y en CI.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          include: ['shared/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/test/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['server/test/setup.ts'],
          // Valores FALSOS solo para pasar la validacion de env.ts. Nunca se
          // conecta a Supabase: los repositories estan mockeados.
          env: {
            NODE_ENV: 'test',
            SUPABASE_URL: 'https://test-project.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
            JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef0123456789abcdef',
            JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef0123456789abcdef',
            CORS_ORIGINS: 'http://localhost:5173',
          },
        },
      },
    ],
  },
});
