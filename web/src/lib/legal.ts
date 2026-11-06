/** Operator details shown on the Privacy Policy and Terms (set in the host's env). */
function read(v: string | undefined): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export const LEGAL = {
  operator: read(import.meta.env.VITE_LEGAL_OPERATOR) ?? 'JalanGo',
  contactEmail: read(import.meta.env.VITE_CONTACT_EMAIL),
  lastUpdated: '6 November 2026',
  /** Region of the Supabase project that stores account and community data */
  dataRegion: 'Sydney, Australia (Supabase ap-southeast-2)',
} as const;
