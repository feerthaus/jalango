/**
 * Runtime configuration read from Vite env vars.
 * Only PUBLIC values may live here — they are shipped to the browser.
 */
function read(key: keyof ImportMetaEnv): string | null {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

const mapboxToken = read('VITE_MAPBOX_PUBLIC_TOKEN');

if (mapboxToken?.startsWith('sk.')) {
  // A secret token must never be bundled into the client.
  console.error('[JalanGo] VITE_MAPBOX_PUBLIC_TOKEN looks like a SECRET token (sk.*). It will be ignored.');
}

export const env = {
  mapboxToken: mapboxToken && mapboxToken.startsWith('pk.') ? mapboxToken : null,
  apiBaseUrl: (read('VITE_API_BASE_URL') ?? '').replace(/\/$/, ''),
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
} as const;

export const features = {
  /** Mapbox vector tiles; otherwise an open raster basemap is used */
  mapboxTiles: env.mapboxToken !== null,
  supabase: env.supabaseUrl !== null && env.supabaseAnonKey !== null,
} as const;

/** Geographic centre used before a GPS fix (Kuala Lumpur city centre). */
export const DEFAULT_CENTER = { lng: 101.6958, lat: 3.1466 } as const;
export const DEFAULT_ZOOM = 11;
