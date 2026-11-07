import type { Route } from '@/types';

/** Speed limit (km/h) on the segment we're on, or null when unknown. */
export function limitAt(route: Route | null, segment: number | undefined): number | null {
  if (!route?.maxspeeds || segment === undefined) return null;
  return route.maxspeeds[Math.min(Math.max(0, segment), route.maxspeeds.length - 1)] ?? null;
}

/** A small tolerance like a car speedometer's: 5 km/h, or 5% on fast roads. */
export function isSpeeding(kmh: number, limit: number | null): boolean {
  if (limit === null) return false;
  return kmh > limit + Math.max(5, Math.round(limit * 0.05));
}
