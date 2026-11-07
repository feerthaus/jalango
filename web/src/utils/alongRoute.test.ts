import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { pointAt, rankAlong, samplePointsAhead } from './alongRoute';
import { buildRouteIndex } from './routeProgress';

// Straight line due south ~222 km (2 degrees of latitude)
const route = {
  id: 'r', geometry: { type: 'LineString', coordinates: [[101.5, 3.5], [101.5, 2.5], [101.5, 1.5]] },
  distanceMeters: 222_000, durationSeconds: 9000, summary: '', hasTolls: false, hasMotorway: true, source: 'mapbox',
  steps: [{ instruction: 'Go', distanceMeters: 222_000, durationSeconds: 9000, maneuver: { type: 'depart', location: { lat: 3.5, lng: 101.5 } } }],
} as Route;
const index = buildRouteIndex(route);

describe('pointAt', () => {
  it('interpolates along the line', () => {
    const p = pointAt(index, index.total / 2);
    expect(p.lat).toBeCloseTo(2.5, 2);
    expect(pointAt(index, index.total * 2).lat).toBeCloseTo(1.5, 5);
  });
});

describe('samplePointsAhead', () => {
  it('samples ahead and stops at the destination', () => {
    const pts = samplePointsAhead(index, 0);
    expect(pts.length).toBeGreaterThanOrEqual(6);
    expect(pts.length).toBeLessThanOrEqual(9);
    expect(pts[0].lat).toBeLessThan(3.5);
    for (const p of pts) expect(p.lat).toBeGreaterThanOrEqual(1.5 - 1e-9);
  });
  it('includes the destination area on a short remaining stretch', () => {
    const pts = samplePointsAhead(index, index.total - 8000);
    expect(pts.at(-1)!.lat).toBeCloseTo(1.5, 2);
  });
});

describe('rankAlong', () => {
  it('keeps nearby places ahead, ordered by distance along the route', () => {
    const places = [
      { id: 'far-off', c: { lat: 2.5, lng: 101.8 } }, // ~33 km off the route
      { id: 'later', c: { lat: 2.0, lng: 101.51 } },
      { id: 'soon', c: { lat: 3.0, lng: 101.49 } },
      { id: 'behind', c: { lat: 3.45, lng: 101.5 } },
    ];
    const r = rankAlong(places, (p) => p.c, index, 20_000, 3000);
    expect(r.map((x) => x.item.id)).toEqual(['soon', 'later']);
    expect(r[0].ahead).toBeGreaterThan(30_000);
    expect(r[0].offset).toBeLessThan(2000);
  });
});
