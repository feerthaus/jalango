/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_PUBLIC_TOKEN?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_LEGAL_OPERATOR?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** Sentry DSN (public by design); empty = crash reporting off */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
