import type { Bounds } from '@/services/reportsService';

/** ~`km` box around a point. */
export function boundsAround(lat: number, lng: number, km = 25): Bounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export const boundsContain = (b: Bounds, lat: number, lng: number) => lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
