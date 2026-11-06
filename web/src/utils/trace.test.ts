import { describe, expect, it } from 'vitest';
import { pathLength, roundPath, sampleWaypoints, simplify, trimEnds, type LngLat } from './trace';

// ~2.2 km straight north with a slight wiggle, 101 points
const line: LngLat[] = Array.from({ length: 101 }, (_, i) => [101.7 + (i % 2) * 0.00001, 3.1 + i * 0.0002]);

describe('trace utils', () => {
  it('measures length', () => {
    expect(pathLength(line)).toBeGreaterThan(2200);
    expect(pathLength(line)).toBeLessThan(2250);
  });

  it('simplifies an almost straight line to its ends', () => {
    expect(simplify(line, 12)).toHaveLength(2);
    const corner: LngLat[] = [[101.7, 3.1], [101.7, 3.11], [101.71, 3.11]];
    expect(simplify(corner, 12)).toHaveLength(3);
  });

  it('trims both ends', () => {
    const t = trimEnds(line, 300);
    expect(pathLength(t)).toBeGreaterThan(1580);
    expect(pathLength(t)).toBeLessThan(1650);
    expect(t[0][1]).toBeGreaterThan(3.1026);
    expect(trimEnds(line, 2000)).toEqual([]);
  });

  it('samples waypoints along the path', () => {
    const w = sampleWaypoints(line, 6);
    expect(w).toHaveLength(7);
    expect(w[0].lat).toBeCloseTo(3.1, 4);
    expect(w[6].lat).toBeCloseTo(3.12, 3);
  });

  it('rounds coordinates', () => {
    expect(roundPath([[101.123456789, 3.987654321]])).toEqual([[101.12346, 3.98765]]);
  });
});
