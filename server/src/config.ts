import 'dotenv/config';

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  mapboxToken: process.env.MAPBOX_ACCESS_TOKEN?.trim() || null,
  supabaseUrl: process.env.SUPABASE_URL?.trim() || null,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
} as const;

export const integrations = {
  mapbox: Boolean(config.mapboxToken),
  supabase: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
};
