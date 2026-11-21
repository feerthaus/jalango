/**
 * Where a first visit came from (Sprint 3, growth tracking). Pure, so it's
 * unit-tested; the result is sent once per new device (lib/activity.ts).
 *
 * Order: utm_* tags, then ad click IDs (read to name the channel, never kept),
 * then the referring site, else "direct". WhatsApp and TikTok's in-app browser
 * usually send no referrer, so their links need utm tags (our share links add
 * them; see shareLinks.ts).
 */

export const SOURCES = ['google', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'telegram', 'x', 'threads', 'youtube', 'email', 'sms', 'search_other', 'referral', 'direct', 'other'] as const;
export const MEDIUMS = ['organic', 'paid', 'social', 'share', 'bio', 'broadcast', 'referral', 'email', 'none', 'other'] as const;
export type Source = (typeof SOURCES)[number];
export type Medium = (typeof MEDIUMS)[number];

export interface Attribution {
  source: Source;
  medium: Medium;
  campaign: string | null;
  refDomain: string | null;
  landing: string;
}

/** Common spellings of utm_source → our fixed list */
const SOURCE_ALIASES: Record<string, Source> = {
  google: 'google', 'google.com': 'google', gads: 'google', adwords: 'google',
  facebook: 'facebook', fb: 'facebook', 'facebook.com': 'facebook', meta: 'facebook',
  instagram: 'instagram', ig: 'instagram', insta: 'instagram',
  tiktok: 'tiktok', tt: 'tiktok', 'tiktok.com': 'tiktok',
  whatsapp: 'whatsapp', wa: 'whatsapp', 'whatsapp.com': 'whatsapp',
  telegram: 'telegram', tg: 'telegram',
  x: 'x', twitter: 'x', 'x.com': 'x',
  threads: 'threads',
  youtube: 'youtube', yt: 'youtube',
  email: 'email', newsletter: 'email', mail: 'email',
  sms: 'sms',
};

const MEDIUM_ALIASES: Record<string, Medium> = {
  organic: 'organic', seo: 'organic',
  paid: 'paid', cpc: 'paid', ppc: 'paid', ads: 'paid', ad: 'paid', paidsocial: 'paid', paid_social: 'paid',
  social: 'social', post: 'social',
  share: 'share',
  bio: 'bio', linkinbio: 'bio', link_in_bio: 'bio',
  broadcast: 'broadcast', group: 'broadcast', status: 'broadcast',
  referral: 'referral',
  email: 'email', newsletter: 'email',
};

/** Lower-case, safe characters only, at most 40 (kept for campaigns). */
export function cleanTag(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || null;
}

/** "/home", "/sewa/abc" → first two path parts, safe characters only; anything else "/". */
export function cleanLanding(path: string): string {
  const p = path.toLowerCase().split(/[?#]/)[0].split('/').filter(Boolean).slice(0, 2).join('/');
  const safe = `/${p}`.replace(/[^a-z0-9/_-]/g, '').slice(0, 61);
  return /^\/[a-z0-9/_-]{0,60}$/.test(safe) ? safe : '/';
}

function referrerHost(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const isSite = (host: string, ...domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

export function classifyVisit(input: { search: string; referrer: string; path: string; ownHost: string }): Attribution {
  const q = new URLSearchParams(input.search);
  const landing = cleanLanding(input.path);
  const campaign = cleanTag(q.get('utm_campaign'));
  const host = referrerHost(input.referrer);
  const fromUs = host !== null && (host === input.ownHost.replace(/^www\./, '') || host === 'localhost' || host === '127.0.0.1');
  const refDomain = host && !fromUs ? host.slice(0, 100) : null;

  // 1. utm tags
  const utmSource = cleanTag(q.get('utm_source'));
  const utmMedium = cleanTag(q.get('utm_medium'));
  if (utmSource) {
    return { source: SOURCE_ALIASES[utmSource] ?? 'other', medium: (utmMedium && MEDIUM_ALIASES[utmMedium]) || (utmMedium ? 'other' : 'none'), campaign, refDomain, landing };
  }
  // 2. ad click IDs (only the channel is kept)
  if (q.has('gclid') || q.has('gbraid') || q.has('wbraid')) return { source: 'google', medium: 'paid', campaign, refDomain, landing };
  if (q.has('ttclid')) return { source: 'tiktok', medium: 'paid', campaign, refDomain, landing };
  if (q.has('fbclid')) return { source: host && isSite(host, 'instagram.com') ? 'instagram' : 'facebook', medium: 'social', campaign, refDomain, landing };
  // 3. referring site
  if (host && !fromUs) {
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return { source: 'google', medium: 'organic', campaign, refDomain, landing };
    if (isSite(host, 'facebook.com', 'fb.com', 'fb.me')) return { source: 'facebook', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 'instagram.com')) return { source: 'instagram', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 'tiktok.com')) return { source: 'tiktok', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 't.co', 'x.com', 'twitter.com')) return { source: 'x', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 'threads.net', 'threads.com')) return { source: 'threads', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 'youtube.com', 'youtu.be')) return { source: 'youtube', medium: 'social', campaign, refDomain, landing };
    if (isSite(host, 'whatsapp.com', 'wa.me')) return { source: 'whatsapp', medium: 'share', campaign, refDomain, landing };
    if (isSite(host, 't.me', 'telegram.org')) return { source: 'telegram', medium: 'share', campaign, refDomain, landing };
    if (isSite(host, 'bing.com', 'duckduckgo.com', 'yahoo.com', 'search.yahoo.com', 'ecosia.org', 'search.brave.com')) return { source: 'search_other', medium: 'organic', campaign, refDomain, landing };
    return { source: 'referral', medium: 'referral', campaign, refDomain, landing };
  }
  return { source: 'direct', medium: 'none', campaign, refDomain: null, landing };
}

/** Our own link with utm tags (shared links say where they were shared). Other sites' links are left alone. */
export function withUtm(url: string, siteUrl: string, source: string, medium = 'share', campaign?: string): string {
  if (!url.startsWith(siteUrl)) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has('utm_source')) return url;
    u.searchParams.set('utm_source', source);
    u.searchParams.set('utm_medium', medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    return url;
  }
}
