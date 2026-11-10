import type { Coordinates } from '@/types';
import { haversineMeters } from './geo';

export type LngLat = [number, number];

const toC = (p: LngLat): Coordinates => ({ lng: p[0], lat: p[1] });

export function pathLength(path: LngLat[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineMeters(toC(path[i - 1]), toC(path[i]));
  return d;
}

/** Perpendicular distance (m) from p to segment a-b, local planar approximation. */
function segDistance(p: LngLat, a: LngLat, b: LngLat): number {
  const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110_574;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Douglas–Peucker simplification with a tolerance in metres (iterative). */
export function simplify(path: LngLat[], toleranceM = 12): LngLat[] {
  if (path.length <= 2) return path.slice();
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDistance(path[i], path[s], path[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

/** Remove the first and last `meters` of a path (privacy: hides home/work). */
export function trimEnds(path: LngLat[], meters: number): LngLat[] {
  const total = pathLength(path);
  if (total <= meters * 2) return [];
  return slice(path, meters, total - meters);
}

/** Part of the path between two distances along it, with interpolated end points. */
export function slice(path: LngLat[], from: number, to: number): LngLat[] {
  const out: LngLat[] = [];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const seg = haversineMeters(toC(a), toC(b));
    const segStart = acc, segEnd = acc + seg;
    const lerp = (d: number): LngLat => {
      const t = seg > 0 ? (d - segStart) / seg : 0;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    };
    if (segEnd >= from && segStart <= to) {
      if (out.length === 0) out.push(from > segStart ? lerp(from) : a);
      if (segEnd <= to) out.push(b);
      else {
        out.push(lerp(to));
        break;
      }
    }
    acc = segEnd;
  }
  return out;
}

/** Up to `max` evenly spaced points along the path (excluding the very ends), for routing via. */
export function sampleWaypoints(path: LngLat[], max = 10): Coordinates[] {
  const total = pathLength(path);
  if (total === 0 || path.length < 2) return [];
  const n = Math.min(max, Math.max(2, Math.round(total / 400)));
  const pts: Coordinates[] = [];
  for (let k = 0; k <= n; k++) {
    const d = (total * k) / n;
    const s = slice(path, d, d);
    if (s[0]) pts.push(toC(s[0]));
  }
  return pts;
}

/** Round coordinates to ~1 m to keep stored paths small. */
export function roundPath(path: LngLat[]): LngLat[] {
  return path.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
}

/**
 * Shrink a long recorded trace so recording can carry on (a 450 km trip
 * at 20 m spacing would be ~22,000 points). Simplifies with a growing
 * tolerance until it is at most half the size; the last point is kept.
 */
export function thinTrace(path: LngLat[], maxPoints = 4000): LngLat[] {
  const target = Math.floor(maxPoints / 2);
  if (path.length <= target) return path;
  let out = simplify(path, 5);
  for (let tol = 10; out.length > target && tol < 5000; tol *= 2) out = simplify(path, tol);
  if (out.length > target) {
    const step = Math.ceil(out.length / target);
    out = out.filter((_, i) => i % step === 0 || i === out.length - 1);
  }
  return out;
}
