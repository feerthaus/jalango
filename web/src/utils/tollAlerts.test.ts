import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { buildRouteIndex } from './routeProgress';
import { tollPhrase, tollsOnRoute, tollTip } from './tollAlerts';

const route = { geometry: { type: 'LineString', coordinates: [[101.7, 3.0], [101.7, 3.1]] }, steps: [] } as unknown as Route;

describe('toll alerts', () => {
  it('keeps toll points on the route, in order, without near-duplicates', () => {
    const idx = buildRouteIndex(route);
    const on = tollsOnRoute(idx, [
      { type: 'booth', name: 'B', location: { lng: 101.7, lat: 3.08 } },
      { type: 'booth', name: 'A', location: { lng: 101.7, lat: 3.02 } },
      { type: 'booth', name: 'A again', location: { lng: 101.7, lat: 3.0201 } },
      { type: 'gantry', location: { lng: 101.75, lat: 3.05 } }, // 5 km off the route
    ]);
    expect(on.map((o) => o.toll.name)).toEqual(['A', 'B']);
  });
  it('tips by payment method', () => {
    const plaza = { type: 'booth' as const, name: 'Plaza Tol Sungai Besi', location: { lng: 0, lat: 0 } };
    expect(tollTip(plaza, 'rfid', 'ms')).toBe('Guna lorong RFID. Pastikan baki mencukupi.');
    expect(tollTip(plaza, null, 'ms')).toBe('Sediakan bayaran tol.');
    expect(tollPhrase(plaza, 'tng', '1 kilometer', 'ms')).toBe("Plaza Tol Sungai Besi dalam 1 kilometer. Sediakan kad Touch 'n Go dan guna lorong TnG.");
    expect(tollTip({ ...plaza, type: 'gantry' }, 'rfid', 'ms')).toMatch(/tanpa berhenti/);
  });
});
