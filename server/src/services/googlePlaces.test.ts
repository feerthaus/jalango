/**
 * Google Places only fills in homestays / car rentals when Mapbox finds few,
 * counts every call under its own daily ceiling, and never breaks the result
 * when Google fails or the ceiling is reached.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let route: typeof import('../routes/geocoding.js');
let usage: typeof import('../lib/usageGuard.js');
let gp: typeof import('./googlePlaces.js');

beforeAll(async () => {
  process.env.MAPBOX_ACCESS_TOKEN = 'pk.test';
  process.env.GOOGLE_PLACES_API_KEY = 'g-test-key';
  vi.resetModules();
  route = await import('../routes/geocoding.js');
  usage = await import('../lib/usageGuard.js');
  gp = await import('./googlePlaces.js');
});
afterEach(() => {
  vi.unstubAllGlobals();
  usage.setUsageCounter(null);
});

const mbFeature = (name: string, lng: number, lat: number) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { mapbox_id: `mb-${name}`, name, feature_type: 'poi', full_address: `${name}, Kelantan` },
});
const gPlace = (id: string, name: string, lng: number, lat: number) => ({ id, displayName: { text: name }, formattedAddress: `${name}, Kelantan`, location: { latitude: lat, longitude: lng } });

function stub(mapboxCount: number, google: unknown, googleStatus = 200) {
  const calls: { host: string; path: string; headers: Record<string, string>; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ host: url.hostname, path: url.pathname, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.hostname === 'places.googleapis.com') return new Response(JSON.stringify(google), { status: googleStatus });
    const features = Array.from({ length: mapboxCount }, (_, i) => mbFeature(`Homestay ${i}`, 102.24 + i * 0.01, 6.12));
    return new Response(JSON.stringify({ features }), { status: 200 });
  });
  return calls;
}
const near = { lng: 102.24, lat: 6.12 };
const googleCalls = (c: { host: string }[]) => c.filter((x) => x.host === 'places.googleapis.com');

describe('rentals with Google Places fill-in', () => {
  it('enough Mapbox results: Google is not called', async () => {
    const calls = stub(6, {});
    const r = await route.searchRentals('homestay', near);
    expect(r).toHaveLength(6);
    expect(googleCalls(calls)).toHaveLength(0);
  });

  it('few Mapbox results: one Google text search, same-name duplicates dropped, labelled google', async () => {
    const calls = stub(1, { places: [gPlace('a', 'Homestay 0', 102.2401, 6.1201), gPlace('b', 'Homestay Mak Teh', 102.25, 6.13)] });
    const r = await route.searchRentals('homestay', near);
    const g = googleCalls(calls);
    expect(g).toHaveLength(1);
    expect(g[0].path).toBe('/v1/places:searchText');
    expect(g[0].headers['X-Goog-Api-Key']).toBe('g-test-key');
    expect(g[0].headers['X-Goog-FieldMask']).toBe('places.id,places.displayName,places.formattedAddress,places.location');
    expect((g[0].body as { textQuery: string }).textQuery).toBe('homestay');
    expect(r.map((p) => `${p.name}/${p.source}`)).toEqual(['Homestay 0/mapbox', 'Homestay Mak Teh/google']);
  });

  it('car rental uses Nearby Search with the car_rental type, nearest first', async () => {
    const calls = stub(0, { places: [gPlace('c', 'Kereta Sewa Maju', 102.25, 6.13)] });
    const r = await route.searchRentals('car_rental', near);
    const body = googleCalls(calls)[0].body as { includedTypes: string[]; rankPreference: string };
    expect(googleCalls(calls)[0].path).toBe('/v1/places:searchNearby');
    expect(body.includedTypes).toEqual(['car_rental']);
    expect(body.rankPreference).toBe('DISTANCE');
    expect(r[0]).toMatchObject({ name: 'Kereta Sewa Maju', source: 'google', id: 'google:c' });
  });

  it('Google failing still returns the Mapbox results', async () => {
    stub(2, { error: 'nope' }, 403);
    const r = await route.searchRentals('homestay', near);
    expect(r).toHaveLength(2);
  });

  it('counts Google under google_places and stops at its daily ceiling (150)', async () => {
    const kinds: string[] = [];
    let googleTotal = 150;
    usage.setUsageCounter(async (kind, n) => {
      kinds.push(kind);
      return kind === 'google_places' ? (googleTotal += n) : 1;
    });
    const calls = stub(1, { places: [gPlace('x', 'Homestay X', 102.25, 6.13)] });
    const r = await route.searchRentals('homestay', near);
    expect(kinds).toContain('google_places');
    expect(googleCalls(calls)).toHaveLength(0); // refused before calling Google
    expect(r).toHaveLength(1); // Mapbox result still shown
  });

  it('Mapbox entries named only "homestay" do not count: Google still fills in, nearest first', async () => {
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === 'places.googleapis.com') {
        expect(JSON.parse(String(init?.body)).rankPreference).toBe('DISTANCE');
        return new Response(JSON.stringify({ places: [gPlace('h', 'Homestay Mak Long', 102.25, 6.13)] }), { status: 200 });
      }
      const features = Array.from({ length: 5 }, (_, i) => mbFeature(i % 2 ? 'Homestay' : 'homestay', 102.24 + i * 0.01, 6.12));
      return new Response(JSON.stringify({ features }), { status: 200 });
    });
    const r = await route.searchRentals('homestay', near);
    expect(r.at(-1)).toMatchObject({ name: 'Homestay Mak Long', source: 'google' });
    expect(gp.isGenericName('Kereta Sewa')).toBe(true);
    expect(gp.isGenericName('Kereta Sewa Kota Bharu')).toBe(false);
  });

  it('mergeWithGoogle keeps different places with the same name far apart', () => {
    const a = { id: '1', name: 'Homestay Ali', address: '', coordinates: { lat: 6.1, lng: 102.2 }, kind: 'poi' as const, source: 'mapbox' as const };
    const b = { ...a, id: '2', coordinates: { lat: 6.3, lng: 102.4 }, source: 'google' as const };
    expect(gp.mergeWithGoogle([a], [b])).toHaveLength(2);
  });
});
