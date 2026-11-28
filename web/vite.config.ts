import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { normaliseSiteUrl, robotsTxt, sitemapXml } from './src/lib/sitePaths';

/**
 * One site address for the whole build (VITE_SITE_URL, else the Netlify one):
 * fills __SITE_URL__ in index.html and writes robots.txt and sitemap.xml.
 */
function siteFiles(site: string): Plugin {
  const files = () => ({ 'robots.txt': robotsTxt(site), 'sitemap.xml': sitemapXml(site, new Date().toISOString().slice(0, 10)) });
  return {
    name: 'jalango-site-files',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url === '/robots.txt' ? 'robots.txt' : req.url === '/sitemap.xml' ? 'sitemap.xml' : null;
        if (!name) return next();
        res.setHeader('Content-Type', name.endsWith('.xml') ? 'application/xml' : 'text/plain');
        res.end(files()[name]);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

/**
 * Which commit this build is. Netlify sets COMMIT_REF (and CONTEXT) while building;
 * locally it is "local". The app knows it (__APP_COMMIT__) and /version.json says it,
 * so "merged" and "live" can be told apart (main is not live until this matches).
 */
function buildVersion(): Plugin {
  const commit = process.env.COMMIT_REF?.trim() || 'local';
  const builtAt = new Date().toISOString();
  return {
    name: 'jalango-version',
    config: () => ({ define: { __APP_COMMIT__: JSON.stringify(commit), __APP_BUILT_AT__: JSON.stringify(builtAt) } }),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ commit, builtAt, context: process.env.CONTEXT ?? null })}\n` });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), buildVersion(), siteFiles(normaliseSiteUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL))],
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
}));
