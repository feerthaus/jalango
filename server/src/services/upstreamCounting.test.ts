/**
 * Every paid Mapbox request must be counted exactly once — including the
 * search fallbacks, along-route fan-out, the R&R/EV text fallback and the
 * directions retry without a heading.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setUsageCounter, type UsageCounter } from '../lib/usageGuard.js';

let mapbox: typeof import('./mapbox.js');
let directions: typeof import('./directions.js');

beforeAll(async () => {
  process.env.MAPBOX_ACCESS_TOKEN = 'pk.test';
  vi.resetModules();
  mapbox = await import('./mapbox.js');
  directions = await import('./directions.js');
  ({ setUsageCounterFresh } = await import('../lib/usageGuard.js').then((m) => ({ setUsageCounterFresh: m.setUsageCounter })));
});
let setUsageCounterFresh: typeof setUsageCounter;

const feature = (name: string, lng = 101.6, lat = 3.1, type = 'poi') => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { mapbox_id: `${name}-${lng}`, name, feature_type: type, full_address: `${name}, Selangor` },
});

function mockUpstream(handler: (url: URL) => unknown) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.hostname + url.pathname);
    const body = handler(url);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

function countingCounter() {
  const counts = { geo: 0, directions: 0 };
  const c: UsageCounter = vi.fn(async (kind, n) => (counts[kind] += n));
  setUsageCounterFresh(c);
  return counts;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUsageCounterFresh?.(null);
});

const paid = (calls: string[]) => calls.filter((c) => c.startsWith('api.mapbox.com')).length;

describe('half-typed place names', () => {
  it('finds "Awana Sky" by searching "Awana" and keeping names with every typed piece', async () => {
    const counts = countingCounter();
    const calls = mockUpstream((url) => {
      if (url.hostname === 'photon.komoot.io') return { features: [] };
      if (url.searchParams.get('q') === 'Awana') return { features: [feature('Awana Puri Condominium'), feature('Awana Skyway', 101.78), feature('Resorts World Awana', 101.79)] };
      return { features: [] };
    });
    const res = await mapbox.searchPlaces('Awana Sky', { lng: 101.6, lat: 3.1 });
    expect(res.map((p) => p.name)).toEqual(['Awana Skyway']);
    expect(paid(calls)).toBe(counts.geo); // every Mapbox call counted
  });
  it('matches a name typed with a space in it ("Sky Way")', () => {
    expect(mapbox.nameHasAllTokens('Awana SkyWay Chin Swee Station', 'awana sky way')).toBe(true);
    expect(mapbox.nameHasAllTokens('Resorts World Awana', 'awana sky')).toBe(false);
    expect(mapbox.completeWordsOf('Awana Sky')).toBe('Awana');
    expect(mapbox.completeWordsOf('KL')).toBeNull();
  });
});

describe('upstream request counting', () => {
  it('plain search: one Search Box call, counted once', async () => {
    const counts = countingCounter();
    const calls = mockUpstream(() => ({ features: [feature('A'), feature('B', 101.7), feature('C', 101.8)] }));
    await mapbox.searchPlaces('kfc', { lng: 101.6, lat: 3.1 });
    expect(paid(calls)).toBe(1);
    expect(counts.geo).toBe(1);
  });

  it('street search with fallbacks: every Mapbox call counted, free OSM calls not', async () => {
    const counts = countingCounter();
    // Mapbox finds nothing → geocoding fallback, spaced retry, and OpenStreetMap (free)
    const calls = mockUpstream((u) => (u.hostname === 'photon.komoot.io' ? { features: [] } : { features: [] }));
    await mapbox.searchPlaces('jalan cj7', { lng: 101.6, lat: 3.1 });
    expect(counts.geo).toBe(paid(calls));
    expect(paid(calls)).toBeGreaterThanOrEqual(3);
    expect(calls.some((c) => c.startsWith('photon.komoot.io'))).toBe(true);
  });

  it('along-route fan-out: one count per sample point', async () => {
    const counts = countingCounter();
    const calls = mockUpstream(() => ({ features: [feature('Warung')] }));
    await mapbox.searchAlong('food', [
      { lng: 101.6, lat: 3.1 },
      { lng: 101.7, lat: 3.0 },
      { lng: 101.8, lat: 2.9 },
    ]);
    expect(paid(calls)).toBe(3);
    expect(counts.geo).toBe(3);
  });

  it('R&R category with empty result: the text fallback is counted too', async () => {
    const counts = countingCounter();
    const calls = mockUpstream((u) => (u.pathname.includes('/category/') ? { features: [] } : { features: [feature('R&R Ayer Keroh')] }));
    await mapbox.searchCategory('rnr', { lng: 102.3, lat: 2.27 });
    expect(paid(calls)).toBe(2);
    expect(counts.geo).toBe(2);
  });

  it('directions retry without heading: both attempts counted', async () => {
    const counts = countingCounter();
    let n = 0;
    const calls = mockUpstream(() => (++n === 1 ? { code: 'NoSegment', message: 'no road' } : { code: 'Ok', routes: [] }));
    await directions.getDirections({ lng: 101.6, lat: 3.1 }, { lng: 101.7, lat: 3.2 }, { heading: 90 }).catch(() => {});
    expect(paid(calls)).toBe(2);
    expect(counts.directions).toBe(2);
  });

  it('refuses before calling Mapbox once the daily quota is used up', async () => {
    setUsageCounterFresh(async () => 999_999);
    const calls = mockUpstream(() => ({ features: [] }));
    await expect(mapbox.searchPlaces('kfc')).rejects.toMatchObject({ status: 503, code: 'daily_quota' });
    expect(paid(calls)).toBe(0);
  });
});
