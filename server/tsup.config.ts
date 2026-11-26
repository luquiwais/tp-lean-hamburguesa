import { defineConfig } from 'tsup';

// Bundlea el server en dist/index.js. @burger/shared se incluye en el bundle
// porque se publica como TypeScript fuente (no tiene build propio).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@burger/shared'],
});
