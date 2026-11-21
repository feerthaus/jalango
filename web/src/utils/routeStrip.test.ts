import { describe, expect, it } from 'vitest';
import type { Route, TrafficReport } from '@/types';
import { buildRouteIndex } from './routeProgress';
import { clusterMarkers, routeStrip } from './routeStrip';

// Straight line north, 4 equal segments (~1.1 km each)
const route: Route = {
  id: 't',
  geometry: { type: 'LineString', coordinates: [[101.7, 3.1], [101.7, 3.11], [101.7, 3.12], [101.7, 3.13], [101.7, 3.14]] },
  distanceMeters: 4423,
  durationSeconds: 400,
  summary: '',
  hasTolls: true,
  hasMotorway: false,
  source: 'mapbox',
  congestion: ['low', 'heavy', 'heavy', 'moderate'],
  tollPoints: [{ type: 'booth', name: 'Plaza Tol Test', location: { lng: 101.7, lat: 3.125 } }, { type: 'booth', location: { lng: 101.8, lat: 3.125 } }],
  steps: [],
};
const report = { id: 'r1', report_type: 'police', latitude: 3.135, longitude: 101.7 } as TrafficReport;

describe('routeStrip', () => {
  const index = buildRouteIndex(route);
  it('places slow traffic, reports and tolls along what is left', () => {
    const s = routeStrip(route, index, 0, [{ report, along: index.total * 0.875 }]);
    expect(s.runs).toHaveLength(2);
    expect(s.runs[0]).toMatchObject({ congestion: 'heavy' });
    expect(s.runs[0].from).toBeCloseTo(0.25, 2);
    expect(s.runs[0].to).toBeCloseTo(0.75, 2);
    expect(s.runs[1]).toMatchObject({ congestion: 'moderate' });
    expect(s.markers.map((m) => m.kind)).toEqual(['toll', 'report']); // the off-route plaza is left out
    expect(s.markers[0].pos).toBeCloseTo(0.625, 2);
  });
  it('rescales from the driver, dropping what is behind', () => {
    const s = routeStrip(route, index, index.total / 2, [{ report, along: index.total * 0.25 }]);
    expect(s.runs[0].from).toBe(0);
    expect(s.runs[0].to).toBeCloseTo(0.5, 2);
    expect(s.markers.map((m) => m.kind)).toEqual(['toll']);
    expect(s.markers[0].pos).toBeCloseTo(0.25, 2);
    expect(routeStrip(route, index, index.total, [])).toEqual({ runs: [], markers: [] });
  });
});

describe('clusterMarkers', () => {
  it('draws markers that would overlap as one with a count', () => {
    const c = clusterMarkers([{ pos: 0.01 }, { pos: 0.03 }, { pos: 0.06 }, { pos: 0.5 }, { pos: 0.9 }]);
    expect(c.map((x) => [x.marker.pos, x.more])).toEqual([[0.01, 2], [0.5, 0], [0.9, 0]]);
  });
});
