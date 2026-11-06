import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { bearingDeg, buildRouteIndex, computeProgress, sliceRoute } from './routeProgress';

// An L-shaped route: ~1.1 km north, then ~1.1 km east
const route: Route = {
  id: 't',
  geometry: { type: 'LineString', coordinates: [[101.7, 3.1], [101.7, 3.11], [101.71, 3.11]] },
  distanceMeters: 2217,
  durationSeconds: 240,
  summary: '',
  hasTolls: false,
  hasMotorway: false,
  source: 'mapbox',
  steps: [
    { instruction: 'Head north', distanceMeters: 1106, durationSeconds: 120, maneuver: { type: 'depart', location: { lng: 101.7, lat: 3.1 } } },
    { instruction: 'Turn right', distanceMeters: 1111, durationSeconds: 120, maneuver: { type: 'turn', modifier: 'right', location: { lng: 101.7, lat: 3.11 } } },
    { instruction: 'Arrive', distanceMeters: 0, durationSeconds: 0, maneuver: { type: 'arrive', location: { lng: 101.71, lat: 3.11 } } },
  ],
};

describe('route progress', () => {
  const index = buildRouteIndex(route);

  it('indexes cumulative distance and step starts', () => {
    expect(index.total).toBeGreaterThan(2150);
    expect(index.total).toBeLessThan(2250);
    expect(index.stepStarts[0]).toBe(0);
    expect(index.stepStarts[1]).toBeCloseTo(index.cum[1], 0);
    expect(index.stepStarts[2]).toBeCloseTo(index.total, 0);
  });

  it('tracks progress half-way along the first leg', () => {
    const p = computeProgress(route, index, { lng: 101.7001, lat: 3.105 });
    expect(p.stepIndex).toBe(0);
    expect(p.offset).toBeLessThan(20);
    expect(p.distanceToManeuver).toBeGreaterThan(500);
    expect(p.distanceToManeuver).toBeLessThan(600);
    expect(p.remainingSeconds).toBeGreaterThan(160);
    expect(p.arrived).toBe(false);
    expect(Math.round(p.bearing)).toBe(0);
  });

  it('moves to the next step after the turn', () => {
    const p = computeProgress(route, index, { lng: 101.705, lat: 3.11 });
    expect(p.stepIndex).toBe(1);
    expect(Math.round(p.bearing)).toBe(90);
  });

  it('detects off-route and arrival', () => {
    expect(computeProgress(route, index, { lng: 101.69, lat: 3.105 }).offset).toBeGreaterThan(1000);
    expect(computeProgress(route, index, { lng: 101.7099, lat: 3.11 }).arrived).toBe(true);
  });

  it('computes bearings', () => {
    expect(Math.round(bearingDeg([0, 0], [0, 1]))).toBe(0);
    expect(Math.round(bearingDeg([0, 0], [1, 0]))).toBe(90);
  });
});

describe('sliceRoute', () => {
  const index = buildRouteIndex(route);
  it('returns the driven part, interpolating the last point', () => {
    const part = sliceRoute(index, index.cum[1] / 2);
    expect(part).toHaveLength(2);
    expect(part[1][1]).toBeCloseTo(3.105, 3);
    expect(sliceRoute(index, 0)).toEqual([]);
    expect(sliceRoute(index, index.total + 10)).toHaveLength(3);
  });
});
