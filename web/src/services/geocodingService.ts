import { DEMO_PLACES } from '@/data/demoPlaces';
import type { Coordinates, ExploreCategory, Place, SearchResponse } from '@/types';
import { normalizeText } from '@/utils/format';
import { haversineMeters } from '@/utils/geo';
import { ApiError, apiGet, isServiceUnavailable } from './apiClient';

/** Search the bundled demo dataset by name, address, postcode or state. */
export function searchDemoPlaces(query: string, near?: Coordinates | null, limit = 8): Place[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const terms = q.split(' ');

  return DEMO_PLACES.map((place): { place: Place; score: number } | null => {
    const name = normalizeText(place.name);
    const haystack = `${name} ${normalizeText(place.address)} ${normalizeText(place.state ?? '')}`;
    if (!terms.every((t) => haystack.includes(t))) return null;
    let score = 0;
    if (place.postcode?.startsWith(q)) score += 5;
    if (name.startsWith(q)) score += 4;
    else if (name.includes(q)) score += 2;
    if (place.kind === 'place') score += 1;
    const distanceMeters = near ? haversineMeters(near, place.coordinates) : undefined;
    return { place: { ...place, distanceMeters }, score };
  })
    .filter((r): r is { place: Place; score: number } => r !== null)
    .sort((a, b) => b.score - a.score || (a.place.distanceMeters ?? 0) - (b.place.distanceMeters ?? 0))
    .slice(0, limit)
    .map((r) => r.place);
}

export const LINK_UNREADABLE = 'link';

/** A pasted link (e.g. shared from Google Maps) or "lat, lng" — resolved by the server instead of searched. */
export function looksLikeLinkOrCoords(q: string): boolean {
  const t = q.trim();
  return /^https:\/\/\S+$/i.test(t) || /^-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}$/.test(t);
}

const DEMO_NOTICE_UNREACHABLE = 'Live search is unavailable right now — showing offline sample places.';

export async function searchPlaces(
  query: string,
  opts: { near?: Coordinates | null; signal?: AbortSignal; live: boolean },
): Promise<SearchResponse> {
  if (!opts.live) {
    return { results: searchDemoPlaces(query, opts.near), mode: 'demo' };
  }
  if (looksLikeLinkOrCoords(query)) {
    const { result } = await apiGet<{ result: Place | null }>('/geo/link', { url: query, lng: opts.near?.lng, lat: opts.near?.lat }, opts.signal);
    return { results: result ? [result] : [], mode: 'live', notice: result ? undefined : LINK_UNREADABLE };
  }
  try {
    const { results } = await apiGet<{ results: Place[] }>(
      '/geo/search',
      { q: query, lng: opts.near?.lng, lat: opts.near?.lat },
      opts.signal,
    );
    const withDistance = opts.near
      ? results.map((p) => ({ ...p, distanceMeters: p.distanceMeters ?? haversineMeters(opts.near!, p.coordinates) }))
      : results;
    return { results: withDistance, mode: 'live' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (isServiceUnavailable(err)) {
      return { results: searchDemoPlaces(query, opts.near), mode: 'demo', notice: DEMO_NOTICE_UNREACHABLE };
    }
    throw err;
  }
}

export async function reverseGeocode(at: Coordinates, signal?: AbortSignal): Promise<Place | null> {
  const { result } = await apiGet<{ result: Place | null }>('/geo/reverse', { lng: at.lng, lat: at.lat }, signal);
  return result;
}

/**
 * Nearby category search (petrol, R&R, …). Live-only: we deliberately do NOT
 * invent petrol stations or R&R locations when the live service is missing.
 */
export async function searchNearbyCategory(category: ExploreCategory, near: Coordinates, signal?: AbortSignal): Promise<Place[]> {
  const { results } = await apiGet<{ results: Place[] }>('/geo/category', { category, lng: near.lng, lat: near.lat }, signal);
  return results
    .map((p) => ({ ...p, distanceMeters: p.distanceMeters ?? haversineMeters(near, p.coordinates) }))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

export { ApiError };

export type AlongCategory = 'food' | 'cafe' | 'attraction' | 'rnr' | 'petrol' | 'ev' | 'stay';

/** Places of a category around sample points ahead on the route (live only — never sample data). */
export async function searchAlongRoute(category: AlongCategory, points: Coordinates[], signal?: AbortSignal): Promise<Place[]> {
  const { results } = await apiGet<{ results: Place[] }>(
    '/geo/along',
    { category, points: points.map((p) => `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`).join(';') },
    signal,
  );
  return results;
}

export interface PlaceInfo {
  rating: number | null;
  ratings: number | null;
  openNow: boolean | null;
  googleMapsUri: string | null;
}

const infoCache = new Map<string, PlaceInfo | null>();

/**
 * Google rating and "open now" for one tapped place (server-side, daily cap).
 * Remembered for this session only, so tapping the same pin again is free.
 */
export async function fetchPlaceInfo(place: Pick<Place, 'id' | 'name' | 'coordinates'>, signal?: AbortSignal): Promise<PlaceInfo | null> {
  if (infoCache.has(place.id)) return infoCache.get(place.id) ?? null;
  try {
    const { info } = await apiGet<{ info: PlaceInfo | null }>('/geo/place-info', { name: place.name, lng: place.coordinates.lng, lat: place.coordinates.lat }, signal);
    infoCache.set(place.id, info);
    return info;
  } catch {
    return null; // cap reached or no Google key: just don't show it
  }
}
