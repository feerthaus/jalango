import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { guardUsage } from '../lib/usageGuard.js';
import type { Coordinates, Place } from '../types.js';
import { boxAround } from './mapbox.js';

/**
 * Google Places API (New), used only to fill in nearby homestays and car
 * rentals when Mapbox finds few. Results are shown as they come (labelled
 * Google) and never stored: Google's terms don't allow caching place content.
 */
const BASE = 'https://places.googleapis.com/v1/places';
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location';
const TIMEOUT_MS = 6000;
const RADIUS_KM = 25;

interface GPlace {
  id?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export const googlePlacesEnabled = () => Boolean(config.googlePlacesKey);

async function post(path: string, body: unknown, fields = FIELDS, kind: 'google_places' | 'google_place_info' = 'google_places'): Promise<GPlace[]> {
  if (!config.googlePlacesKey) return [];
  await guardUsage(kind); // every paid Google call counts against its own daily ceiling
  const res = await fetch(`${BASE}:${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': config.googlePlacesKey, 'X-Goog-FieldMask': fields },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(502, 'google_places_failed', `Google Places responded ${res.status}`);
  const data = (await res.json()) as { places?: GPlace[] };
  return data.places ?? [];
}

function toPlaces(list: GPlace[]): Place[] {
  return list.flatMap((g) => {
    const lat = g.location?.latitude;
    const lng = g.location?.longitude;
    const name = g.displayName?.text?.trim();
    if (!g.id || !name || typeof lat !== 'number' || typeof lng !== 'number') return [];
    return [{ id: `google:${g.id}`, name, address: g.formattedAddress ?? '', coordinates: { lat, lng }, kind: 'poi' as const, source: 'google' as const }];
  });
}

/** Car rental: Google's own place type, nearest first, within ~25 km. */
export async function googleCarRentals(near: Coordinates, limit = 10): Promise<Place[]> {
  return toPlaces(
    await post('searchNearby', {
      includedTypes: ['car_rental'],
      maxResultCount: Math.min(limit, 20),
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: RADIUS_KM * 1000 } },
      languageCode: 'ms',
      regionCode: 'MY',
    }),
  );
}

/** Homestay: text search for "homestay" kept inside a ~25 km box around the user. */
export async function googleHomestays(near: Coordinates, limit = 10): Promise<Place[]> {
  const [minLng, minLat, maxLng, maxLat] = boxAround(near, RADIUS_KM).split(',').map(Number);
  return toPlaces(
    await post('searchText', {
      textQuery: 'homestay',
      pageSize: Math.min(limit, 20),
      rankPreference: 'DISTANCE',
      locationRestriction: { rectangle: { low: { latitude: minLat, longitude: minLng }, high: { latitude: maxLat, longitude: maxLng } } },
      languageCode: 'ms',
      regionCode: 'MY',
    }),
  );
}

/** Map entries named only "homestay" / "kereta sewa" etc. are not useful to a renter. */
const GENERIC = new Set(['homestay', 'homestays', 'home stay', 'kereta sewa', 'car rental', 'rental', 'sewa kereta']);
export const isGenericName = (name: string) => GENERIC.has(name.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim());

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const closeBy = (a: Coordinates, b: Coordinates) => Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lng - b.lng) < 0.002; // ~200 m

/** Add Google results that aren't already in the list (same name nearby). */
export function mergeWithGoogle(base: Place[], extra: Place[]): Place[] {
  const out = [...base];
  for (const g of extra) {
    if (!out.some((p) => norm(p.name) === norm(g.name) && closeBy(p.coordinates, g.coordinates))) out.push(g);
  }
  return out;
}

export interface PlaceInfo {
  rating: number | null;
  ratings: number | null;
  openNow: boolean | null;
  googleMapsUri: string | null;
}

/**
 * Rating and "open now" for one place the user tapped. These are Enterprise
 * fields (1,000 free calls a month), so they have their own small daily cap
 * (google_place_info, default 30) and are never fetched for every pin.
 */
export async function googlePlaceInfo(name: string, near: Coordinates): Promise<PlaceInfo | null> {
  if (!config.googlePlacesKey) return null;
  const list = await post(
    'searchText',
    {
      textQuery: name,
      pageSize: 1,
      locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 300 } },
      languageCode: 'ms',
      regionCode: 'MY',
    },
    'places.id,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.googleMapsUri',
    'google_place_info',
  );
  const g = list[0];
  const lat = g?.location?.latitude;
  const lng = g?.location?.longitude;
  // Only trust a match that is really this place (within ~400 m)
  if (!g || typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat - near.lat) > 0.004 || Math.abs(lng - near.lng) > 0.004) return null;
  return {
    rating: typeof g.rating === 'number' ? g.rating : null,
    ratings: typeof g.userRatingCount === 'number' ? g.userRatingCount : null,
    openNow: typeof g.currentOpeningHours?.openNow === 'boolean' ? g.currentOpeningHours.openNow : null,
    googleMapsUri: g.googleMapsUri ?? null,
  };
}
