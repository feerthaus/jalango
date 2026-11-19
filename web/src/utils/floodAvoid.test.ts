import { describe, expect, it } from 'vitest';
import { pickAvoidPoints, tripBounds } from './floodAvoid';

const from = { lat: 3.0, lng: 101.5 };
const to = { lat: 3.0, lng: 101.7 };
const flood = (lat: number, lng: number, passable: boolean | null = false, status = 'active') =>
  ({ report_type: 'flood' as const, flood_passable: passable, status: status as 'active', latitude: lat, longitude: lng });

describe('pickAvoidPoints', () => {
  it('keeps only active floods reported impassable', () => {
    const pts = pickAvoidPoints([flood(3.0, 101.6), flood(3.0, 101.61, true), flood(3.0, 101.62, null), flood(3.0, 101.63, false, 'resolved')], from, to);
    expect(pts).toEqual([{ lat: 3.0, lng: 101.6 }]);
  });

  it('never excludes the start or the destination itself', () => {
    expect(pickAvoidPoints([flood(3.0, 101.5005), flood(3.0, 101.6995)], from, to)).toEqual([]);
  });

  it('keeps the floods nearest the trip, at most the limit', () => {
    const far = flood(3.2, 101.6);
    const near = Array.from({ length: 12 }, (_, i) => flood(3.0 + i * 0.001, 101.55 + i * 0.005));
    const pts = pickAvoidPoints([far, ...near], from, to);
    expect(pts).toHaveLength(10);
    expect(pts).not.toContainEqual({ lat: 3.2, lng: 101.6 });
  });

  it('looks in the trip box plus a margin', () => {
    const b = tripBounds(from, to, 15);
    expect(b.minLat).toBeLessThan(2.9);
    expect(b.maxLng).toBeGreaterThan(101.8);
  });
});
