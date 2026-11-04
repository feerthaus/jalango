import type { Coordinates } from '@/types';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle ("straight-line") distance in metres. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '–';
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** m/s → rounded km/h. */
export function toKmh(metersPerSecond: number): number {
  return Math.max(0, Math.round(metersPerSecond * 3.6));
}

export function formatCoordinates({ lat, lng }: Coordinates): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Rough Malaysia bounds incl. Sabah & Sarawak. */
export function isInMalaysia({ lat, lng }: Coordinates): boolean {
  return lat >= 0.8 && lat <= 7.4 && lng >= 99.6 && lng <= 119.3;
}
