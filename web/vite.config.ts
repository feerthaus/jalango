import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Allow quick phone testing through a Cloudflare quick tunnel (see README)
    allowedHosts: ['.trycloudflare.com'],
    // In development the Express API runs separately; proxy /api to it.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
  build: {
    // mapbox-gl alone is ~1.6 MB minified; keep it (and React) in long-cached vendor chunks.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'mapbox', test: /node_modules[\\/]mapbox-gl/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
