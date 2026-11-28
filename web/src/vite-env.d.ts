/// <reference types="vite/client" />

/** Commit this build was made from (Netlify COMMIT_REF; "local" otherwise) */
declare const __APP_COMMIT__: string;
/** When this build was made (ISO time) */
declare const __APP_BUILT_AT__: string;

interface ImportMetaEnv {
  readonly VITE_MAPBOX_PUBLIC_TOKEN?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_LEGAL_OPERATOR?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** Sentry DSN (public by design); empty = crash reporting off */
  readonly VITE_SENTRY_DSN?: string;
  /** Public address of the site (canonical URLs, shared links, sitemap). Default: https://jalango.netlify.app */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
