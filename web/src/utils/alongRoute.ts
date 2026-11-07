import type { Coordinates } from '@/types';
import { projectOnRoute, type RouteIndex } from './routeProgress';

/** Point at `distance` metres along the route line. */
export function pointAt(index: RouteIndex, distance: number): Coordinates {
  const { coords, cum } = index;
  if (coords.length === 0) return { lng: 0, lat: 0 };
  const d = Math.min(Math.max(0, distance), index.total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1];
  const t = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  const [a, b] = [coords[i - 1], coords[i] ?? coords[i - 1]];
  return { lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t };
}

/** Kilometres ahead at which we search; denser close by, sparser far away. */
const AHEAD_KM = [2, 12, 25, 45, 70, 100, 135, 175];

/** Up to 8 search points ahead of `along` (metres), never past the destination. */
export function samplePointsAhead(index: RouteIndex, along: number, maxAheadKm = 175): Coordinates[] {
  const remainingKm = Math.max(0, (index.total - along) / 1000);
  const kms = AHEAD_KM.filter((k) => k <= maxAheadKm && k < remainingKm);
  // the destination area itself, when it is within reach and not already covered
  if (remainingKm <= maxAheadKm && (kms.length === 0 || remainingKm - kms[kms.length - 1] > 5)) {
    if (kms.length === AHEAD_KM.length) kms.pop();
    kms.push(remainingKm);
  }
  return kms.map((k) => pointAt(index, along + k * 1000));
}

export interface AlongItem<T> {
  item: T;
  /** metres ahead of the driver along the route */
  ahead: number;
  /** metres off the route line (straight line) */
  offset: number;
}

/**
 * Keep places close to the route and ahead of us, ordered by when we'd reach them.
 * Places just behind (within `behindM`) are kept so a stop you just passed doesn't flicker away.
 */
export function rankAlong<T>(items: T[], at: (t: T) => Coordinates, index: RouteIndex, along: number, maxOffsetM: number, behindM = 300): AlongItem<T>[] {
  const out: AlongItem<T>[] = [];
  for (const item of items) {
    const p = projectOnRoute(index, at(item));
    const ahead = p.along - along;
    if (ahead < -behindM || p.offset > maxOffsetM) continue;
    out.push({ item, ahead, offset: p.offset });
  }
  return out.sort((a, b) => a.ahead - b.ahead);
}
