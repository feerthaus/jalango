import { describe, expect, it } from 'vitest';
import type { CommunityRoute, Route } from '@/types';
import { daysAgo, divergence, matchesTrip, prepareRoutePath, suggestCommunityRoutes } from './communityRoutes';
import { buildRouteIndex } from './routeProgress';
import { pathLength, thinTrace, type LngLat } from './trace';

/** Straight line of n points from a to b. */
function line(a: LngLat, b: LngLat, n: number): LngLat[] {
  return Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)] as LngLat);
}

// KL → Kota Bharu, roughly: main route up the east (via Kuantan), alternative inland (via Gua Musang)
const KL: LngLat = [101.69, 3.14];
const KB: LngLat = [102.24, 6.12];
const mainPath = [...line(KL, [103.33, 3.82], 200), ...line([103.33, 3.82], KB, 200).slice(1)];
const inland = [...line(KL, [101.97, 4.87], 200), ...line([101.97, 4.87], KB, 200).slice(1)];
const mainRoute = { geometry: { type: 'LineString', coordinates: mainPath }, steps: [] } as unknown as Route;

const cr = (over: Partial<CommunityRoute> = {}): CommunityRoute => ({
  id: 'r1', user_id: 'u1', title: 'Ikut Gua Musang', via_label: null, note: null, path: inland,
  start_lat: KL[1], start_lng: KL[0], end_lat: KB[1], end_lng: KB[0],
  distance_m: 450_000, duration_s: 6 * 3600, driven_at: new Date().toISOString(), upvotes: 3, downvotes: 0, created_at: new Date().toISOString(),
  ...over,
});

describe('prepareRoutePath', () => {
  it('trims 1 km from each end and keeps at most 800 points', () => {
    const trace = line(KL, KB, 20_000);
    const p = prepareRoutePath(trace)!;
    expect(p.path.length).toBeLessThanOrEqual(800);
    expect(Math.abs(pathLength(trace) - p.distance - 2000)).toBeLessThan(200);
  });
  it('rejects short trips', () => {
    expect(prepareRoutePath(line(KL, [101.75, 3.2], 100))).toBeNull();
  });
});

describe('thinTrace', () => {
  it('halves a long wiggly trace and keeps both ends', () => {
    const t: LngLat[] = Array.from({ length: 4000 }, (_, i) => [101 + i * 0.001, 3 + (i % 2) * 0.002]);
    const out = thinTrace(t);
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out[0]).toEqual(t[0]);
    expect(out[out.length - 1]).toEqual(t[t.length - 1]);
  });
});

describe('matching and suggestions', () => {
  const from = { lng: KL[0], lat: KL[1] };
  const to = { lng: KB[0], lat: KB[1] };
  it('matches routes with both ends nearby only', () => {
    expect(matchesTrip(cr(), from, to)).toBe(true);
    expect(matchesTrip(cr({ end_lat: 5.4, end_lng: 103.1 }), from, to)).toBe(false); // ends in Kuala Terengganu
  });
  it('measures how much of a route leaves the main road', () => {
    const idx = buildRouteIndex(mainRoute);
    expect(divergence(idx, inland)).toBeGreaterThan(0.6);
    expect(divergence(idx, mainPath)).toBe(0);
  });
  it('offers real alternatives, best voted first, and skips copies of the main route', () => {
    const idx = buildRouteIndex(mainRoute);
    const list = [cr({ id: 'a', upvotes: 1 }), cr({ id: 'b', upvotes: 9 }), cr({ id: 'same', path: mainPath, upvotes: 50 })];
    expect(suggestCommunityRoutes(idx, from, to, list).map((s) => s.route.id)).toEqual(['b', 'a']);
  });
  it('counts whole days', () => {
    expect(daysAgo(new Date(Date.now() - 3.5 * 86_400_000).toISOString())).toBe(3);
  });
});
