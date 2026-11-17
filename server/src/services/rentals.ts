import type { Coordinates, Place } from '../types.js';
import { MALAYSIA_BBOX, photonToPlace, searchCategory, type PhotonFeature } from './mapbox.js';

/**
 * Nearby homestays and car rentals: Mapbox first, then OpenStreetMap (Photon)
 * fills in when Mapbox finds few with a real name. Both may be shown on our
 * Mapbox map (Google Places data may not be used on a non-Google map).
 * OSM data © OpenStreetMap contributors.
 */

function haversineMeters(a: Coordinates, b: Coordinates): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Fewer useful Mapbox results than this and OpenStreetMap fills in. */
export const OSM_FILL_BELOW = 5;
const RADIUS_M = 25_000;

/** Map entries named only "homestay" / "kereta sewa" etc. are not useful to a renter. */
const GENERIC = new Set(['homestay', 'homestays', 'home stay', 'kereta sewa', 'car rental', 'rental', 'sewa kereta']);
export const isGenericName = (name: string) => GENERIC.has(name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim());

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const closeBy = (a: Coordinates, b: Coordinates) => Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lng - b.lng) < 0.002; // ~200 m

/** Add places that aren't already in the list (same name nearby). */
export function mergeNew(base: Place[], extra: Place[]): Place[] {
  const out = [...base];
  for (const g of extra) {
    if (!out.some((p) => norm(p.name) === norm(g.name) && closeBy(p.coordinates, g.coordinates))) out.push(g);
  }
  return out;
}

/** What to ask Photon: a word plus the OSM tags that mean this kind of place. */
const OSM_QUERY: Record<'homestay' | 'car_rental', { q: string[]; tags: string[] }> = {
  homestay: { q: ['homestay'], tags: ['tourism:guest_house', 'tourism:chalet', 'tourism:apartment', 'tourism:hostel'] },
  car_rental: { q: ['car rental', 'kereta sewa'], tags: ['amenity:car_rental'] },
};

async function photon(q: string, tags: string[], near: Coordinates, limit: number): Promise<Place[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(Math.min(limit, 20)));
  url.searchParams.set('bbox', MALAYSIA_BBOX);
  url.searchParams.set('lat', String(near.lat));
  url.searchParams.set('lon', String(near.lng));
  for (const t of tags) url.searchParams.append('osm_tag', t);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { 'User-Agent': 'JalanGo/1.0 (+https://jalango.netlify.app)' } });
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return (body.features ?? []).map(photonToPlace).filter((p): p is Place => p !== null);
  } catch {
    return [];
  }
}

/** OpenStreetMap places of this kind within ~25 km, nearest first, generic names dropped. */
export async function osmRentals(category: 'homestay' | 'car_rental', near: Coordinates, limit = 10): Promise<Place[]> {
  const { q, tags } = OSM_QUERY[category];
  const lists = await Promise.all(q.map((word) => photon(word, tags, near, limit)));
  return mergeNew([], lists.flat())
    .map((p) => ({ ...p, kind: 'poi' as const, distanceMeters: haversineMeters(near, p.coordinates) }))
    .filter((p) => p.distanceMeters <= RADIUS_M && !isGenericName(p.name))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/**
 * Mapbox first; OpenStreetMap only when Mapbox finds few with a real name.
 * Either side failing still returns what the other found.
 */
export async function searchRentals(category: 'homestay' | 'car_rental', near: Coordinates, limit?: number): Promise<Place[]> {
  let mapbox: Place[] = [];
  let mapboxError: unknown = null;
  try {
    mapbox = await searchCategory(category, near, limit);
  } catch (err) {
    mapboxError = err;
  }
  const useful = mapbox.filter((p) => !isGenericName(p.name)).length;
  if (useful >= OSM_FILL_BELOW) return mapbox;
  const osm = await osmRentals(category, near, limit);
  if (mapboxError && osm.length === 0) throw mapboxError;
  return mergeNew(mapbox, osm);
}
