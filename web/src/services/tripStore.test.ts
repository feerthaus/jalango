import { beforeEach, describe, expect, it } from 'vitest';
import { clearTrip, loadTrip, saveTrip, TRIP_MAX_AGE_MS } from './tripStore';

const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const destination = { id: 'p', name: 'Mid Valley', address: 'KL', coordinates: { lat: 3.1179, lng: 101.6776 }, kind: 'poi' as const, source: 'mapbox' as const, distanceMeters: 1234 };

describe('tripStore', () => {
  beforeEach(() => mem.clear());

  it('saves and restores a trip (without the stale distance)', () => {
    saveTrip({ destination, avoidTolls: true, navigating: true });
    const t = loadTrip();
    expect(t?.destination.name).toBe('Mid Valley');
    expect(t?.destination.distanceMeters).toBeUndefined();
    expect(t?.navigating).toBe(true);
    expect(t?.avoidTolls).toBe(true);
  });

  it('expires old trips', () => {
    saveTrip({ destination, avoidTolls: false, navigating: true });
    expect(loadTrip(Date.now() + TRIP_MAX_AGE_MS + 1)).toBeNull();
    expect(mem.size).toBe(0);
  });

  it('ignores corrupt data and clears', () => {
    mem.set('jalango:active-trip', '{"nope":1}');
    expect(loadTrip()).toBeNull();
    saveTrip({ destination, avoidTolls: false, navigating: false });
    clearTrip();
    expect(loadTrip()).toBeNull();
  });
});

describe('saved trip route', () => {
  it('keeps the road route for the same destination only', async () => {
    const { saveTripRoute, loadTripRoute, clearTrip } = await import('./tripStore');
    const route = { id: 'r', source: 'mapbox', steps: [], geometry: { type: 'LineString', coordinates: [[101, 3], [102, 2]] } } as unknown as import('@/types').Route;
    saveTripRoute('bp', route);
    expect(loadTripRoute('bp')?.id).toBe('r');
    expect(loadTripRoute('other')).toBeNull();
    expect(loadTripRoute('bp', Date.now() + 9 * 3600_000)).toBeNull();
    clearTrip();
    expect(loadTripRoute('bp')).toBeNull();
  });
});
