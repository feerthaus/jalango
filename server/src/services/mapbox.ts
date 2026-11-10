import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { guardUsage } from '../lib/usageGuard.js';
import type { Coordinates, Place, PlaceKind } from '../types.js';

const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';
const GEOCODE = 'https://api.mapbox.com/search/geocode/v6';
const TIMEOUT_MS = 6000;

/** Malaysia bounding box (minLng, minLat, maxLng, maxLat) incl. Sabah & Sarawak. */
export const MALAYSIA_BBOX = '99.6,0.8,119.3,7.4';

/** Category ids exposed to clients → Mapbox Search Box canonical ids. */
export const CATEGORY_MAP = {
  petrol: 'gas_station',
  ev: 'ev_charging_station',
  parking: 'parking_lot',
  hospital: 'hospital',
  food: 'restaurant',
  cafe: 'cafe',
  attraction: 'tourist_attraction',
} as const;
export type CategoryId = keyof typeof CATEGORY_MAP | 'rnr';

interface MapboxFeature {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    address?: string;
    feature_type?: string;
    poi_category?: string[];
    distance?: number;
    coordinates?: { longitude: number; latitude: number };
  };
}

const KINDS: PlaceKind[] = ['poi', 'address', 'street', 'postcode', 'locality', 'place', 'district', 'region'];

export function normalizeFeature(f: MapboxFeature): Place | null {
  const p = f.properties ?? {};
  const lng = p.coordinates?.longitude ?? f.geometry?.coordinates?.[0];
  const lat = p.coordinates?.latitude ?? f.geometry?.coordinates?.[1];
  const name = p.name_preferred ?? p.name;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !name) return null;

  const kind = (KINDS as string[]).includes(p.feature_type ?? '') ? (p.feature_type as PlaceKind) : 'other';
  const address = p.full_address ?? p.place_formatted ?? p.address ?? '';

  return {
    id: p.mapbox_id ?? f.id ?? `${lng},${lat}`,
    name,
    // Avoid repeating the name when the full address starts with it
    address: address.startsWith(`${name}, `) ? address.slice(name.length + 2) : address,
    coordinates: { lng, lat },
    kind,
    category: p.poi_category?.[0],
    source: 'mapbox',
    distanceMeters: typeof p.distance === 'number' ? p.distance : undefined,
  };
}

async function request(url: URL): Promise<MapboxFeature[]> {
  if (!config.mapboxToken) {
    throw new HttpError(503, 'mapbox_not_configured', 'Mapbox is not configured on the server');
  }
  await guardUsage('geo'); // every paid Mapbox call, including retries and fan-out
  url.searchParams.set('access_token', config.mapboxToken);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new HttpError(502, timedOut ? 'upstream_timeout' : 'upstream_unreachable', 'Map service unavailable');
  }
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(502, 'upstream_auth', 'Map service rejected the server credentials');
  }
  if (res.status === 429) throw new HttpError(429, 'upstream_rate_limited', 'Map service rate limit reached');
  if (!res.ok) throw new HttpError(502, 'upstream_error', `Map service error (${res.status})`);

  const body = (await res.json()) as { features?: MapboxFeature[] };
  return body.features ?? [];
}

function toPlaces(features: MapboxFeature[]): Place[] {
  return features.map(normalizeFeature).filter((p): p is Place => p !== null);
}

const POSTCODE_RE = /^\d{5}$/;

/** "cj7" → "cj 7", "ss2" → "ss 2": Malaysian street codes are written both ways. */
export function spaceStreetCodes(q: string): string {
  return q.replace(/\b([a-z]{1,4})(\d{1,3}[a-z]?)\b/gi, '$1 $2');
}

/** Same place from two sources: same name, or within ~60 m. */
function isDuplicate(a: Place, b: Place): boolean {
  const close = Math.abs(a.coordinates.lat - b.coordinates.lat) < 0.0006 && Math.abs(a.coordinates.lng - b.coordinates.lng) < 0.0006;
  return close || a.name.toLowerCase() === b.name.toLowerCase();
}

export function mergePlaces(primary: Place[], extra: Place[], limit: number): Place[] {
  const out = [...primary];
  for (const p of extra) if (!out.some((q) => isDuplicate(p, q))) out.push(p);
  return out.slice(0, limit);
}

async function searchBox(q: string, near: Coordinates | undefined, limit: number): Promise<Place[]> {
  const url = new URL(`${SEARCHBOX}/forward`);
  url.searchParams.set('q', q);
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 10)));
  if (near) url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  else url.searchParams.set('bbox', MALAYSIA_BBOX);
  return toPlaces(await request(url));
}

/** Geocoding v6 knows many residential streets and addresses that the POI search doesn't. */
async function geocodeStreets(q: string, near: Coordinates | undefined, limit: number): Promise<Place[]> {
  const url = new URL(`${GEOCODE}/forward`);
  url.searchParams.set('q', q);
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 10)));
  url.searchParams.set('types', 'address,street,neighborhood,locality,place');
  if (near) url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  return toPlaces(await request(url));
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
    type?: string;
  };
}

/** Photon (OpenStreetMap) result → Place. Only Malaysian results are kept. */
export function photonToPlace(f: PhotonFeature): Place | null {
  const p = f.properties ?? {};
  const c = f.geometry?.coordinates;
  if (!c || p.countrycode?.toUpperCase() !== 'MY') return null;
  const name = p.name ?? (p.street ? `${p.housenumber ? `${p.housenumber}, ` : ''}${p.street}` : null);
  if (!name) return null;
  const kind: PlaceKind = p.type === 'street' ? 'street' : p.type === 'house' ? 'address' : p.type === 'city' || p.type === 'district' ? 'place' : 'poi';
  const area = [p.district, p.postcode ? `${p.postcode} ${p.city ?? ''}`.trim() : p.city, p.state].filter((x, i, a) => x && a.indexOf(x) === i);
  return {
    id: `osm:${p.osm_type ?? ''}${p.osm_id ?? `${c[0]},${c[1]}`}`,
    name,
    address: area.join(', '),
    coordinates: { lng: c[0], lat: c[1] },
    kind,
    source: 'osm',
  };
}

/**
 * OpenStreetMap search (Photon, by Komoot) — many Malaysian housing-estate
 * streets ("Jalan CJ 7") exist in OSM but not in Mapbox's search. Best effort:
 * short timeout, empty on any error. Data © OpenStreetMap contributors.
 */
export async function searchOsm(q: string, near: Coordinates | undefined, limit: number): Promise<Place[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(Math.min(limit, 10)));
  url.searchParams.set('bbox', MALAYSIA_BBOX);
  if (near) {
    url.searchParams.set('lat', String(near.lat));
    url.searchParams.set('lon', String(near.lng));
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { 'User-Agent': 'JalanGo/1.0 (+https://jalango.netlify.app)' } });
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: PhotonFeature[] };
    return (body.features ?? []).map(photonToPlace).filter((p): p is Place => p !== null);
  } catch {
    return [];
  }
}

const isStreetLike = (p: Place) => p.kind === 'street' || p.kind === 'address';

export async function searchPlaces(query: string, near?: Coordinates, limit = 8): Promise<Place[]> {
  const q = query.trim();

  // Malaysian postcodes (5 digits) resolve best through the geocoding endpoint.
  if (POSTCODE_RE.test(q)) {
    const url = new URL(`${GEOCODE}/forward`);
    url.searchParams.set('q', q);
    url.searchParams.set('country', 'my');
    url.searchParams.set('language', 'en');
    url.searchParams.set('limit', String(Math.min(limit, 10)));
    url.searchParams.set('types', 'postcode');
    if (near) url.searchParams.set('proximity', `${near.lng},${near.lat}`);
    return toPlaces(await request(url));
  }

  // Street-looking queries ask both sources at once; others only fall back when the POI search is thin
  const streety = /\b(jalan|jln|lorong|lrg|persiaran|lebuh|street|road|jalan)\b/i.test(q) || /\b[a-z]{1,4}\s?\d{1,3}\b/i.test(q);
  const [pois, streets] = await Promise.all([
    searchBox(q, near, limit),
    streety ? geocodeStreets(q, near, limit).catch(() => [] as Place[]) : Promise.resolve(null),
  ]);
  let results = streets ? mergePlaces(streets.filter((p) => p.kind === 'street' || p.kind === 'address').concat(pois), [], limit) : pois;
  if (streets) results = mergePlaces(results, streets, limit);
  if (results.length < 3 && !streets) results = mergePlaces(results, await geocodeStreets(q, near, limit).catch(() => []), limit);

  // Asked for a street but Mapbox has none: try OpenStreetMap (as typed, then "cj 7" spacing)
  if (streety && !results.some(isStreetLike)) {
    let osm = await searchOsm(q, near, limit);
    if (!osm.some(isStreetLike) && spaceStreetCodes(q) !== q) osm = osm.concat(await searchOsm(spaceStreetCodes(q), near, limit));
    const osmStreets = osm.filter(isStreetLike);
    // OSM splits one street into several ways: keep the first of each name nearby
    if (osmStreets.length) results = mergePlaces([], osmStreets.concat(results), limit);
  }

  // "cj7" vs "cj 7"
  const spaced = spaceStreetCodes(q);
  if (results.length === 0 && spaced !== q) {
    const [p2, s2] = await Promise.all([searchBox(spaced, near, limit), geocodeStreets(spaced, near, limit).catch(() => [] as Place[])]);
    results = mergePlaces(s2.filter((p) => p.kind === 'street' || p.kind === 'address').concat(p2), s2, limit);
  }

  // Still nothing: the name is half-typed ("Awana Sky") or split differently ("Awana Sky Way").
  // Search the complete words, keep places whose name holds every typed piece, and ask OpenStreetMap too.
  if (results.length === 0) results = await partialNameSearch(q, near, limit);
  return results;
}

/** Lower-case letters and digits only: "Awana SkyWay" → "awanaskyway". */
export const compactName = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Does the place name contain every word the user typed (ignoring spaces)? */
export function nameHasAllTokens(name: string, q: string): boolean {
  const n = compactName(name);
  const tokens = q.split(/\s+/).map(compactName).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => n.includes(t));
}

/** The query minus its last word, while keeping at least one word of 3+ letters. */
export function completeWordsOf(q: string): string | null {
  const words = q.trim().split(/\s+/);
  if (words.length < 2) return null;
  const head = words.slice(0, -1).join(' ');
  return compactName(head).length >= 3 ? head : null;
}

async function partialNameSearch(q: string, near: Coordinates | undefined, limit: number): Promise<Place[]> {
  const head = completeWordsOf(q);
  const [pois, osm] = await Promise.all([
    head ? searchBox(head, near, 10).catch(() => [] as Place[]) : Promise.resolve([] as Place[]),
    searchOsm(q, near, limit),
  ]);
  const matching = pois.filter((p) => nameHasAllTokens(p.name, q));
  return mergePlaces(matching, osm.filter((p) => nameHasAllTokens(p.name, q) || nameHasAllTokens(`${p.name} ${p.address}`, q)), limit);
}

export async function reverseGeocode(at: Coordinates): Promise<Place | null> {
  const url = new URL(`${GEOCODE}/reverse`);
  url.searchParams.set('longitude', String(at.lng));
  url.searchParams.set('latitude', String(at.lat));
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '1');
  return toPlaces(await request(url))[0] ?? null;
}

/**
 * Places of one category along a route: a category search around each sample
 * point ahead of the driver, merged and de-duplicated. The client then keeps
 * only those close to the route line and orders them by distance along it.
 */
export async function searchAlong(category: CategoryId, points: Coordinates[], perPoint = 8): Promise<Place[]> {
  const settled = await Promise.allSettled(points.map((p) => searchCategory(category, p, perPoint)));
  const ok = settled.filter((s): s is PromiseFulfilledResult<Place[]> => s.status === 'fulfilled');
  if (ok.length === 0 && settled.length > 0) throw (settled[0] as PromiseRejectedResult).reason;
  const seen = new Map<string, Place>();
  for (const s of ok) for (const p of s.value) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

/** Free-text fallbacks for categories whose canonical id may return nothing in Malaysia. */
const FALLBACK_QUERY: Partial<Record<CategoryId, string>> = {
  rnr: 'rest area',
  ev: 'EV charging station',
};

/** Canonical ids tried first (Search Box category endpoint). */
const CANONICAL: Partial<Record<CategoryId, string>> = {
  rnr: 'rest_area',
  ev: 'charging_station',
};

async function forwardPoi(q: string, near: Coordinates, limit: number): Promise<Place[]> {
  const url = new URL(`${SEARCHBOX}/forward`);
  url.searchParams.set('q', q);
  url.searchParams.set('types', 'poi');
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 10)));
  url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  return toPlaces(await request(url));
}

export async function searchCategory(category: CategoryId, near: Coordinates, limit = 10): Promise<Place[]> {
  const id = CANONICAL[category] ?? CATEGORY_MAP[category as keyof typeof CATEGORY_MAP];
  const url = new URL(`${SEARCHBOX}/category/${id}`);
  url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 25)));
  let results: Place[] = [];
  try {
    results = toPlaces(await request(url));
  } catch (err) {
    if (!FALLBACK_QUERY[category]) throw err; // unknown canonical id → use the text fallback
  }
  const fallback = FALLBACK_QUERY[category];
  if (results.length === 0 && fallback) results = await forwardPoi(fallback, near, limit);
  return results;
}
