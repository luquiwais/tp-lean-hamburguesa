import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // En desarrollo, /api se redirige al server: mismo origen, sin lios de CORS ni cookies.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
