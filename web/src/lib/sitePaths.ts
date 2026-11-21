/**
 * The public website's address and what search engines may index. Plain
 * TypeScript with no imports, so both the app and vite.config.ts (robots.txt,
 * sitemap.xml, index.html) use the same values.
 *
 * Change the address in one place: set VITE_SITE_URL (e.g. https://jalango.my)
 * in the build environment. Without it, the Netlify address is used.
 */
export const DEFAULT_SITE_URL = 'https://jalango.netlify.app';

/** "https://x.my/" or " https://x.my " → "https://x.my"; anything that isn't http(s) falls back to the default. */
export function normaliseSiteUrl(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s) ? s : DEFAULT_SITE_URL;
}

/** Public pages listed in sitemap.xml (the map app is "/", the homepage "/home"). */
export const SITEMAP_PATHS: { path: string; priority: string; changefreq: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/home', priority: '1.0', changefreq: 'weekly' },
  { path: '/', priority: '0.9', changefreq: 'weekly' },
  { path: '/sewa', priority: '0.8', changefreq: 'daily' },
  { path: '/explore', priority: '0.6', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'monthly' },
];

/** Private or per-person pages search engines must not crawl. */
export const ROBOTS_DISALLOW = ['/admin', '/api/', '/live/', '/business/listings/', '/profile', '/saved'];

export function robotsTxt(site: string): string {
  return ['User-agent: *', 'Allow: /', ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`), '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(site: string, lastmod: string): string {
  const urls = SITEMAP_PATHS.map(
    (u) => `  <url>\n    <loc>${site}${u.path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
