import 'dotenv/config';

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Public address of the web app (same value as the web's VITE_SITE_URL). */
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://jalango.netlify.app').trim().replace(/\/+$/, '');

export const config = {
  siteUrl,
  port: Number(process.env.PORT ?? 8787),
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  mapboxToken: process.env.MAPBOX_ACCESS_TOKEN?.trim() || null,
  supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
  /** Claude API (smart search, trip assistant); features stay off without it */
  anthropicKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  /** POI import from GitHub Actions (POI-2B): off unless POI_IMPORT_ENABLED=true and a token of 32+ characters is set */
  poiImportEnabled: process.env.POI_IMPORT_ENABLED?.trim() === 'true',
  poiIngestToken: process.env.POI_INGEST_TOKEN?.trim() || null,
  /** POI-3: JalanGo's own POIs in search (off unless POI_SEARCH_ENABLED=true) */
  poiSearchEnabled: process.env.POI_SEARCH_ENABLED?.trim() === 'true',
} as const;

export const integrations = {
  mapbox: Boolean(config.mapboxToken),
  supabase: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
  ai: Boolean(config.anthropicKey),
};
