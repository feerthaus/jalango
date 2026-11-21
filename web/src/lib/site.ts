import { normaliseSiteUrl } from './sitePaths';

/**
 * The one place the app learns its public address (links people share,
 * canonical URLs, "open jalango…" hints). Set VITE_SITE_URL to move domain.
 */
export const SITE_URL = normaliseSiteUrl(import.meta.env.VITE_SITE_URL);

/** "jalango.netlify.app" */
export const SITE_HOST = new URL(SITE_URL).host;

/** SITE_URL + path ("/home" → "https://jalango.netlify.app/home"). */
export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
