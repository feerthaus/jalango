import type { Coordinates, Route } from '@/types';
import { haversineMeters } from './geo';

/**
 * Pure helpers for following a route: project the GPS fix onto the route
 * line, work out the current/next step, remaining distance and off-route.
 */

const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

export interface RouteIndex {
  coords: [number, number][];
  /** cumulative distance (m) at each vertex */
  cum: number[];
  total: number;
  /** distance along the route at which each step starts */
  stepStarts: number[];
}

export interface Projection {
  along: number;
  /** distance from the fix to the route line (m) */
  offset: number;
  segment: number;
  /** bearing of the route at the projected point (deg) */
  bearing: number;
}

export function bearingDeg(a: [number, number], b: [number, number]): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function projectOnSegment(p: Coordinates, a: [number, number], b: [number, number]) {
  // local planar approximation around p (fine for segments < a few km)
  const kx = mPerDegLng(p.lat);
  const ax = (a[0] - p.lng) * kx;
  const ay = (a[1] - p.lat) * M_PER_DEG_LAT;
  const bx = (b[0] - p.lng) * kx;
  const by = (b[1] - p.lat) * M_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return { t, dist: Math.hypot(px, py) };
}

function projectRange(index: RouteIndex, p: Coordinates, from: number, to: number): Projection | null {
  let best: Projection | null = null;
  const { coords, cum } = index;
  for (let i = Math.max(0, from); i < Math.min(coords.length - 1, to); i++) {
    const { t, dist } = projectOnSegment(p, coords[i], coords[i + 1]);
    if (!best || dist < best.offset) {
      best = { along: cum[i] + t * (cum[i + 1] - cum[i]), offset: dist, segment: i, bearing: bearingDeg(coords[i], coords[i + 1]) };
    }
  }
  return best;
}

/** Project a point onto the route. `hint` (last segment) speeds up the search. */
export function projectOnRoute(index: RouteIndex, p: Coordinates, hint?: number): Projection {
  if (index.coords.length < 2) return { along: 0, offset: haversineMeters(p, toCoords(index.coords[0])), segment: 0, bearing: 0 };
  if (hint !== undefined) {
    const local = projectRange(index, p, hint - 20, hint + 200);
    if (local && local.offset < 60) return local;
  }
  return projectRange(index, p, 0, index.coords.length)!;
}

const toCoords = (c: [number, number]): Coordinates => ({ lng: c[0], lat: c[1] });

export function buildRouteIndex(route: Route): RouteIndex {
  const coords = route.geometry.coordinates as [number, number][];
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineMeters(toCoords(coords[i - 1]), toCoords(coords[i])));
  const index: RouteIndex = { coords, cum, total: cum[cum.length - 1] ?? 0, stepStarts: [] };

  let prevSeg = 0;
  let prevAlong = 0;
  index.stepStarts = route.steps.map((step, i) => {
    if (i === 0) return 0;
    const pr = projectOnRoute(index, step.maneuver.location, prevSeg);
    prevSeg = pr.segment;
    prevAlong = Math.max(prevAlong, pr.along);
    return prevAlong;
  });
  return index;
}

export interface RouteProgress {
  along: number;
  offset: number;
  segment: number;
  bearing: number;
  /** index of the step being driven */
  stepIndex: number;
  /** distance until the next maneuver (start of step stepIndex + 1) */
  distanceToManeuver: number;
  remainingMeters: number;
  remainingSeconds: number;
  arrived: boolean;
}

export function computeProgress(route: Route, index: RouteIndex, p: Coordinates, hint?: number): RouteProgress {
  const pr = projectOnRoute(index, p, hint);
  let stepIndex = 0;
  for (let i = 0; i < index.stepStarts.length; i++) if (index.stepStarts[i] <= pr.along + 10) stepIndex = i;
  const nextStart = index.stepStarts[stepIndex + 1] ?? index.total;
  const remainingMeters = Math.max(0, index.total - pr.along);
  const end = index.coords[index.coords.length - 1];
  const toEnd = end ? haversineMeters(p, toCoords(end)) : remainingMeters;
  return {
    ...pr,
    stepIndex,
    distanceToManeuver: Math.max(0, nextStart - pr.along),
    remainingMeters,
    remainingSeconds: index.total > 0 ? route.durationSeconds * (remainingMeters / index.total) : 0,
    arrived: remainingMeters < 30 || toEnd < 30,
  };
}

/** Straight-line preview used when no routing service is configured (labelled as demo). */
export function straightLineRoute(from: Coordinates, to: Coordinates, destinationName: string): Route {
  const distance = haversineMeters(from, to);
  return {
    id: 'demo-straight',
    geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
    distanceMeters: distance,
    // rough estimate only, at an average 50 km/h — clearly labelled in the UI
    durationSeconds: distance / (50 / 3.6),
    summary: 'Straight-line preview',
    steps: [
      { instruction: `Head towards ${destinationName}`, distanceMeters: distance, durationSeconds: distance / (50 / 3.6), maneuver: { type: 'depart', location: from } },
      { instruction: `Arrive at ${destinationName}`, distanceMeters: 0, durationSeconds: 0, maneuver: { type: 'arrive', location: to } },
    ],
    hasTolls: false,
    hasMotorway: false,
    source: 'demo',
  };
}
