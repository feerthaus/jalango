import type { Coordinates, Place } from '../types.js';
import { searchPlaces } from './mapbox.js';

/**
 * A Google Maps link the user pasted (shared from the Google Maps app, e.g.
 * on WhatsApp) → the place it points to. We only read the link itself:
 * coordinates and name in the URL. No Google API, no Google data stored.
 */

/** Hosts we follow redirects for (short links only lead to Google Maps). */
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co']);
const GOOGLE_HOST = /^(www\.|maps\.)?google\.com(\.[a-z]{2})?$|^consent\.google\.com$/;

const inMalaysia = (c: Coordinates) => c.lat >= 0.5 && c.lat <= 7.6 && c.lng >= 99.4 && c.lng <= 119.5;

export function isMapsLink(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return u.protocol === 'https:' && (SHORT_HOSTS.has(u.hostname) || (GOOGLE_HOST.test(u.hostname) && /\/maps|[?&](q|query|ll)=/.test(u.pathname + u.search)) || u.hostname === 'maps.google.com');
  } catch {
    return false;
  }
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));
function pair(lat: string | undefined, lng: string | undefined): Coordinates | null {
  const c = { lat: num(lat), lng: num(lng) };
  return Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 ? c : null;
}

/** "3.4036, 101.7829" typed or pasted as text. */
export function parseLatLng(text: string): Coordinates | null {
  const m = text.trim().match(/^(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})$/);
  return m ? pair(m[1], m[2]) : null;
}

export interface ParsedLink {
  coordinates?: Coordinates;
  name?: string;
}

/** Coordinates and/or place name from a full Google Maps URL. */
export function parseGoogleMapsUrl(raw: string): ParsedLink | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  // EU consent interstitial wraps the real URL
  if (u.hostname === 'consent.google.com') {
    const cont = u.searchParams.get('continue');
    return cont ? parseGoogleMapsUrl(cont) : null;
  }
  const path = decodeURIComponent(u.pathname);
  const out: ParsedLink = {};

  // Most precise first: the place pin (!3dLAT!4dLNG), then ?q=lat,lng, then the map centre (@lat,lng)
  const pin = [...(u.pathname + u.search).matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)].pop();
  const q = u.searchParams.get('q') ?? u.searchParams.get('query') ?? u.searchParams.get('ll') ?? u.searchParams.get('daddr') ?? u.searchParams.get('destination');
  const qCoords = q ? parseLatLng(q.replace(/\+/g, ' ')) : null;
  const at = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  out.coordinates = (pin && pair(pin[1], pin[2])) || qCoords || (at && pair(at[1], at[2])) || undefined;

  const place = path.match(/\/maps\/(?:place|search|dir\/[^/]*)\/([^/@]+)/);
  const name = place?.[1] ?? (q && !qCoords ? q : undefined);
  if (name) out.name = name.replace(/\+/g, ' ').split(',')[0].trim().slice(0, 120) || undefined;
  if (out.name && parseLatLng(out.name)) out.name = undefined;
  return out.coordinates || out.name ? out : null;
}

/** Follow a short link's redirects (Google hosts only, max 5 hops) to the full Maps URL. */
async function expand(url: string): Promise<string | null> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const u = new URL(current);
    if (u.protocol !== 'https:' || !(SHORT_HOSTS.has(u.hostname) || GOOGLE_HOST.test(u.hostname))) return null;
    if (GOOGLE_HOST.test(u.hostname) && u.hostname !== 'consent.google.com') return current;
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'Mozilla/5.0 (JalanGo link reader)' } });
    const next = res.headers.get('location');
    if (!next) return u.hostname === 'consent.google.com' ? current : null;
    current = new URL(next, current).toString();
  }
  return null;
}

export async function placeFromMapsLink(text: string, near?: Coordinates): Promise<Place | null> {
  const typed = parseLatLng(text);
  if (typed) return inMalaysia(typed) ? pinPlace(typed) : null;
  if (!isMapsLink(text)) return null;
  const u = new URL(text.trim());
  const full = SHORT_HOSTS.has(u.hostname) ? await expand(u.toString()).catch(() => null) : u.toString();
  const parsed = full ? parseGoogleMapsUrl(full) : null;
  if (!parsed) return null;
  if (parsed.coordinates) {
    if (!inMalaysia(parsed.coordinates)) return null;
    return pinPlace(parsed.coordinates, parsed.name);
  }
  // Only a name in the link: look it up ourselves
  const [first] = await searchPlaces(parsed.name!, near, 1);
  return first ?? null;
}

function pinPlace(c: Coordinates, name?: string): Place {
  return {
    id: `link:${c.lat.toFixed(6)},${c.lng.toFixed(6)}`,
    name: name ?? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`,
    address: name ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : 'Lokasi dari pautan',
    coordinates: { lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 },
    kind: 'other',
    source: 'link',
  };
}
