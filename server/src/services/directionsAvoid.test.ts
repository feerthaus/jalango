import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: { mapboxToken: 'test-token' }, integrations: {} }));
vi.mock('../lib/usageGuard.js', () => ({ guardUsage: async () => undefined }));

import { getDirectionsAvoiding } from './directions.js';

const from = { lng: 101.6, lat: 3.0 };
const to = { lng: 101.7, lat: 3.1 };
const route = { distance: 1000, duration: 100, geometry: { type: 'LineString', coordinates: [[101.6, 3.0], [101.7, 3.1]] }, legs: [{ steps: [], summary: 'X' }] };

afterEach(() => vi.unstubAllGlobals());

describe('routes around impassable floods', () => {
  it('asks the router to avoid the points and says how many it avoided', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      asked.push(new URL(String(u)).searchParams.get('exclude') ?? '');
      return Response.json({ code: 'Ok', routes: [route] });
    });
    const r = await getDirectionsAvoiding(from, to, { avoidPoints: [{ lng: 101.65, lat: 3.05 }] });
    expect(r.avoided).toBe(1);
    expect(asked).toEqual(['point(101.65000 3.05000)']);
  });

  it('falls back to a normal route when there is no way around', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      const ex = new URL(String(u)).searchParams.get('exclude') ?? '';
      asked.push(ex);
      return ex ? Response.json({ code: 'NoRoute', message: 'No route' }, { status: 200 }) : Response.json({ code: 'Ok', routes: [route] });
    });
    const r = await getDirectionsAvoiding(from, to, { avoidPoints: [{ lng: 101.65, lat: 3.05 }] });
    expect(r.avoided).toBe(0);
    expect(r.routes).toHaveLength(1);
    expect(asked).toEqual(['point(101.65000 3.05000)', '']);
  });

  it('does nothing extra without points', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls++;
      return Response.json({ code: 'Ok', routes: [route] });
    });
    expect((await getDirectionsAvoiding(from, to, {})).avoided).toBe(0);
    expect(calls).toBe(1);
  });
});
