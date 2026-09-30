import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  base: './',
  define: { 'import.meta.env.VITE_STATIC_PREVIEW': mode === 'pages' },
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  build: { target: 'es2022' },
}));
