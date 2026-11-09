/**
 * Regression: response shapes and status codes of the public API must not
 * change with the Phase A hardening (rate limits + usage guard).
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let server: Server;
let base = '';
let setUsageCounter: typeof import('./lib/usageGuard.js').setUsageCounter;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  process.env.MAPBOX_ACCESS_TOKEN = 'pk.test';
  vi.resetModules();
  const { createApp } = await import('./app.js');
  ({ setUsageCounter } = await import('./lib/usageGuard.js'));
  // Mapbox / OSM are mocked; requests to our own server go through for real
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === '127.0.0.1') return realFetch(input, init);
    if (url.pathname.includes('/directions/')) {
      return Response.json({
        code: 'Ok',
        routes: [{ distance: 1000, duration: 120, geometry: { type: 'LineString', coordinates: [[101.6, 3.1], [101.7, 3.2]] }, legs: [{ steps: [] }] }],
      });
    }
    return Response.json({
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [101.6, 3.1] }, properties: { mapbox_id: 'x', name: 'KFC', feature_type: 'poi', full_address: 'KFC, KL' } }],
    });
  });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server?.close();
  vi.unstubAllGlobals();
  setUsageCounter(null);
});

const get = async (path: string, headers: Record<string, string> = {}) => {
  const r = await realFetch(base + path, { headers });
  return { status: r.status, body: await r.json(), headers: r.headers };
};

describe('API regression', () => {
  it('GET /api/health', async () => {
    const r = await get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, integrations: { mapbox: true } });
  });

  it('GET /api/geo/search → { results: Place[] }', async () => {
    const r = await get('/api/geo/search?q=kfc');
    expect(r.status).toBe(200);
    expect(r.body.results[0]).toMatchObject({ id: 'x', name: 'KFC', coordinates: { lng: 101.6, lat: 3.1 }, kind: 'poi', source: 'mapbox' });
  });

  it('GET /api/directions → { routes: Route[] }', async () => {
    const r = await get('/api/directions?from=101.6,3.1&to=101.7,3.2');
    expect(r.status).toBe(200);
    expect(r.body.routes[0]).toMatchObject({ distanceMeters: 1000, durationSeconds: 120, source: 'mapbox' });
  });

  it('bad input keeps the 400 error shape', async () => {
    const r = await get('/api/directions?from=nope&to=101.7,3.2');
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  });

  it('daily quota → 503 daily_quota, same error shape', async () => {
    setUsageCounter(async () => 1_000_000);
    const r = await get('/api/geo/search?q=nasi lemak', { 'x-nf-client-connection-ip': '198.51.100.20' });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: { code: 'daily_quota', message: expect.any(String) } });
    setUsageCounter(null);
  });

  it('counter down: along-route search fails closed, routing keeps working', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setUsageCounter(async () => {
      throw new Error('down');
    });
    const along = await get('/api/geo/along?category=food&points=101.6,3.1', { 'x-nf-client-connection-ip': '198.51.100.21' });
    expect(along.status).toBe(503);
    expect(along.body.error.code).toBe('usage_counter_unavailable');
    const route = await get('/api/directions?from=101.6,3.1&to=101.7,3.2', { 'x-nf-client-connection-ip': '198.51.100.21' });
    expect(route.status).toBe(200);
    setUsageCounter(null);
  });

  it('rate limit per real client IP: 429 with Retry-After after the limit', async () => {
    const ip = { 'x-nf-client-connection-ip': '198.51.100.99' };
    let last = { status: 0, body: {} as Record<string, unknown>, headers: new Headers() };
    for (let i = 0; i < 16; i++) last = await get('/api/geo/along?category=food&points=101.6,3.1', ip);
    expect(last.status).toBe(429);
    expect(last.body).toEqual({ error: { code: 'rate_limited', message: 'Too many requests, slow down.' } });
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
    // a different visitor is not affected
    expect((await get('/api/geo/along?category=food&points=101.6,3.1', { 'x-nf-client-connection-ip': '198.51.100.100' })).status).toBe(200);
  });
});
