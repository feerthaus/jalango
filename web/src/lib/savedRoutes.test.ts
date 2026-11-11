import { describe, expect, it } from 'vitest';
import type { Trip } from '@/types';
import { reversePath, type LngLat } from '@/utils/trace';
import { compactTrace, routeFromTrip } from './savedRoutes';

const wiggly: LngLat[] = Array.from({ length: 3000 }, (_, i) => [101.6 + i * 0.0002, 3.1 + Math.sin(i / 7) * 0.001]);

describe('saved routes', () => {
  it('keeps a long trace to at most 600 points, same ends', () => {
    const c = compactTrace(wiggly);
    expect(c.length).toBeLessThanOrEqual(600);
    expect(c[0]).toEqual([101.6, 3.1]);
  });
  it('builds a route from a trip, named by the driver or after the destination', () => {
    const trip = { id: 't', destination: { name: 'Kampung', coordinates: { lat: 3.2, lng: 101.8 } }, startedAt: '', endedAt: '', distanceMeters: 60000, durationSeconds: 3600, arrived: true, trace: wiggly } as Trip;
    expect(routeFromTrip(trip, '  Rumah → Kampung ')?.name).toBe('Rumah → Kampung');
    expect(routeFromTrip(trip, '')?.name).toBe('Kampung');
    expect(routeFromTrip({ ...trip, trace: undefined }, 'x')).toBeNull();
  });
  it('reverses a path for the way back', () => {
    expect(reversePath([[1, 1], [2, 2], [3, 3]])).toEqual([[3, 3], [2, 2], [1, 1]]);
  });
});
