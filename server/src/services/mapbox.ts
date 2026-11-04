import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
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

export async function searchPlaces(query: string, near?: Coordinates, limit = 8): Promise<Place[]> {
  const q = query.trim();

  // Malaysian postcodes (5 digits) resolve best through the geocoding endpoint.
  const url = POSTCODE_RE.test(q) ? new URL(`${GEOCODE}/forward`) : new URL(`${SEARCHBOX}/forward`);
  url.searchParams.set('q', q);
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 10)));
  if (POSTCODE_RE.test(q)) url.searchParams.set('types', 'postcode');
  if (near) url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  else url.searchParams.set('bbox', MALAYSIA_BBOX);

  return toPlaces(await request(url));
}

export async function reverseGeocode(at: Coordinates): Promise<Place | null> {
  const url = new URL(`${GEOCODE}/reverse`);
  url.searchParams.set('longitude', String(at.lng));
  url.searchParams.set('latitude', String(at.lat));
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '1');
  return toPlaces(await request(url))[0] ?? null;
}

export async function searchCategory(category: CategoryId, near: Coordinates, limit = 10): Promise<Place[]> {
  if (category === 'rnr') {
    // Malaysian highway rest areas are listed as "R&R" / "Hentian Sebelah".
    const url = new URL(`${SEARCHBOX}/forward`);
    url.searchParams.set('q', 'R&R');
    url.searchParams.set('types', 'poi');
    url.searchParams.set('country', 'my');
    url.searchParams.set('language', 'en');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('proximity', `${near.lng},${near.lat}`);
    return toPlaces(await request(url));
  }

  const url = new URL(`${SEARCHBOX}/category/${CATEGORY_MAP[category]}`);
  url.searchParams.set('proximity', `${near.lng},${near.lat}`);
  url.searchParams.set('country', 'my');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.min(limit, 25)));
  return toPlaces(await request(url));
}
