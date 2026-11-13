import type { Place } from '@/types';

/**
 * A JalanGo link to a place: opens JalanGo with the place selected on the map,
 * ready for directions. Works for anyone (no install needed, it's the web app).
 */
export function placeUrl(place: Pick<Place, 'name' | 'address' | 'coordinates'>, origin = window.location.origin): string {
  const p = new URLSearchParams({ tempat: `${place.coordinates.lat.toFixed(6)},${place.coordinates.lng.toFixed(6)}` });
  const name = place.name.trim().slice(0, 100);
  if (name) p.set('n', name);
  const addr = (place.address ?? '').trim();
  if (addr && addr !== name) p.set('a', addr.slice(0, 160));
  return `${origin}/?${p.toString()}`;
}

/** Read a shared place from the URL. Null if missing or not a valid coordinate. */
export function placeFromParams(params: URLSearchParams): Place | null {
  const raw = params.get('tempat');
  if (!raw) return null;
  const m = raw.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  const name = (params.get('n') ?? '').trim().slice(0, 100) || 'Lokasi dikongsi';
  const address = (params.get('a') ?? '').trim().slice(0, 160) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { id: `shared:${lat.toFixed(6)},${lng.toFixed(6)}`, name, address, coordinates: { lat, lng }, kind: 'poi', source: 'link' };
}
