import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { normalizeApiBase } from './src/client/jevClient.js';

export default defineConfig(({ mode }) => {
  const apiBase = normalizeApiBase(loadEnv(mode, process.cwd(), 'VITE_JEV_API_BASE').VITE_JEV_API_BASE ?? '');
  return {
    base: './',
    define: {
      'import.meta.env.VITE_STATIC_PREVIEW': mode === 'pages' && !apiBase,
      'import.meta.env.VITE_JEV_API_BASE': JSON.stringify(apiBase),
    },
    plugins: [tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': 'http://127.0.0.1:3000' },
    },
    build: { target: 'es2022' },
  };
});
