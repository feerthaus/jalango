import type { Coordinates, CommunityRoute } from '@/types';
import { haversineMeters } from './geo';
import { projectOnRoute, type RouteIndex } from './routeProgress';
import { pathLength, roundPath, simplify, trimEnds, type LngLat } from './trace';

/** First/last km of a shared route are cut off so nobody's home or kampung house is shown. */
export const COMMUNITY_PRIVACY_TRIM_M = 1000;
export const COMMUNITY_MIN_M = 20_000;
export const COMMUNITY_MAX_M = 1_500_000;
export const COMMUNITY_MAX_POINTS = 800;
/** A community route is offered when it starts and ends this close to your trip. */
export const COMMUNITY_MATCH_M = 25_000;

/** Turn a driven trace into a shareable long route, or null when it is too short / too long. */
export function prepareRoutePath(trace: LngLat[]): { path: LngLat[]; distance: number } | null {
  const trimmed = trimEnds(trace, COMMUNITY_PRIVACY_TRIM_M);
  if (trimmed.length < 2) return null;
  let path = simplify(trimmed, 15);
  for (let tol = 30; path.length > COMMUNITY_MAX_POINTS; tol *= 1.6) path = simplify(trimmed, tol);
  path = roundPath(path);
  const distance = pathLength(path);
  if (distance < COMMUNITY_MIN_M || distance > COMMUNITY_MAX_M) return null;
  return { path, distance };
}

/** Does the community route go from (near) `from` to (near) `to`? */
export function matchesTrip(r: Pick<CommunityRoute, 'start_lat' | 'start_lng' | 'end_lat' | 'end_lng'>, from: Coordinates, to: Coordinates, within = COMMUNITY_MATCH_M): boolean {
  return (
    haversineMeters(from, { lat: r.start_lat, lng: r.start_lng }) <= within &&
    haversineMeters(to, { lat: r.end_lat, lng: r.end_lng }) <= within
  );
}

/**
 * Share of the community path (by length) lying more than `offM` from the
 * suggested route. A real alternative leaves the main road for a good while;
 * one that just follows it isn't worth offering.
 */
export function divergence(index: RouteIndex, path: LngLat[], offM = 1500): number {
  let off = 0, total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = haversineMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
    total += seg;
    const mid = { lng: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 };
    if (projectOnRoute(index, mid).offset > offM) off += seg;
  }
  return total > 0 ? off / total : 0;
}

export interface RouteSuggestion {
  route: CommunityRoute;
  /** fraction of the route away from the suggested route */
  divergence: number;
  score: number;
}

/** Community routes worth offering for this trip, best first. */
export function suggestCommunityRoutes(index: RouteIndex, from: Coordinates, to: Coordinates, list: CommunityRoute[], max = 3): RouteSuggestion[] {
  return list
    .filter((r) => matchesTrip(r, from, to))
    .map((r) => ({ route: r, divergence: divergence(index, r.path) }))
    .filter((s) => s.divergence >= 0.1)
    .map((s) => ({ ...s, score: s.route.upvotes - s.route.downvotes }))
    .sort((a, b) => b.score - a.score || Date.parse(b.route.driven_at) - Date.parse(a.route.driven_at))
    .slice(0, max);
}

export function daysAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
}
