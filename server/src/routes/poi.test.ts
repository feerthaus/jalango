import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TOKEN = 'test-token-0123456789abcdefghijklmnopqrstuv';
const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
  if (name === 'poi_start_run') return { data: '11111111-1111-4111-8111-111111111111', error: null };
  if (name === 'poi_ingest') return { data: (args.p_rows as unknown[]).length, error: null };
  if (name === 'poi_process_run') return { data: { status: 'processed', auto_approved: 1 }, error: null };
  if (name === 'hit_rate_limit') return { data: 1, error: null };
  return { data: null, error: { message: 'unknown' } };
});
vi.mock('../lib/supabaseAdmin.js', () => ({ supabaseAdmin: { rpc } }));

const row = {
  osm_ref: 'way/305526685', osm_version: 4, osm_last_edit: '2026-08-09T00:00:00Z', name: 'Caltex R&R Dengkil', category: 'minyak', subcategory: 'Caltex',
  brand: 'Caltex', branch: null, lat: 2.910412, lng: 101.608666, address: null, phone: null, website: null, opening_hours: null,
  tags: { amenity: 'fuel', brand: 'Caltex' }, settlement_class: 'bandar', osm_place_tag: 'suburb', nearest_place: 'Bandar Saujana Putra',
  coastal: false, inside_institution: null, issues: ['nama_jenama_sahaja'], quality: 65, decision: 'auto_approved', reject_reason: null,
};

async function serve(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  const { createApp } = await import('../app.js');
  const server: Server = createApp().listen(0);
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}
const poiCalls = () => rpc.mock.calls.filter(([name]) => String(name).startsWith('poi_'));
const post = (base: string, path: string, body: unknown, token?: string) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

describe('POI import API: switched off by default', () => {
  let s: { server: Server; base: string };
  beforeAll(async () => (s = await serve({ POI_IMPORT_ENABLED: undefined, POI_INGEST_TOKEN: TOKEN })));
  afterAll(() => s.server.close());
  it('answers 503 and calls nothing', async () => {
    const r = await post(s.base, '/api/poi/runs', {}, TOKEN);
    expect(r.status).toBe(503);
    expect(poiCalls()).toHaveLength(0);
  });
});

describe('POI import API: switched on', () => {
  let s: { server: Server; base: string };
  beforeAll(async () => (s = await serve({ POI_IMPORT_ENABLED: 'true', POI_INGEST_TOKEN: TOKEN })));
  afterAll(() => s.server.close());

  it('refuses a missing or wrong token', async () => {
    expect((await post(s.base, '/api/poi/runs', {})).status).toBe(401);
    expect((await post(s.base, '/api/poi/runs', {}, 'wrong-token-but-long-enough-0123456789')).status).toBe(401);
    expect(poiCalls()).toHaveLength(0);
  });

  it('starts a run only for the known regions and a Geofabrik extract', async () => {
    const ok = await post(s.base, '/api/poi/runs', { region: 'kuala-langat', extract_url: 'https://download.geofabrik.de/asia/malaysia-singapore-brunei/malaysia-singapore-brunei-latest.osm.pbf', extract_md5: '2d25056846ea3f2a52f9b57515c89043', extract_timestamp: '2026-11-22T21:20:48Z' }, TOKEN);
    expect(ok.status).toBe(201);
    expect((await ok.json()).run).toMatch(/^[0-9a-f-]{36}$/);
    const sel = await post(s.base, '/api/poi/runs', { region: 'selangor', extract_url: 'https://download.geofabrik.de/asia/malaysia-singapore-brunei/malaysia-singapore-brunei-latest.osm.pbf', extract_md5: '2d25056846ea3f2a52f9b57515c89043', extract_timestamp: '2026-11-27T21:20:48Z' }, TOKEN);
    expect(sel.status).toBe(201);
    const bad = await post(s.base, '/api/poi/runs', { region: 'selangor', extract_url: 'https://evil.example/x.pbf', extract_md5: 'x', extract_timestamp: 'now' }, TOKEN);
    expect(bad.status).toBe(400);
    const other = await post(s.base, '/api/poi/runs', { region: 'johor', extract_url: 'https://download.geofabrik.de/asia/malaysia-singapore-brunei/malaysia-singapore-brunei-latest.osm.pbf', extract_md5: '2d25056846ea3f2a52f9b57515c89043', extract_timestamp: '2026-11-27T21:20:48Z' }, TOKEN);
    expect(other.status).toBe(400);
  });

  it('accepts a batch of valid rows, bigger than the API default body size', async () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ ...row, osm_ref: `node/${i + 1}` }));
    expect(JSON.stringify({ rows }).length).toBeGreaterThan(32_000);
    const r = await post(s.base, '/api/poi/runs/11111111-1111-4111-8111-111111111111/rows', { rows }, TOKEN);
    expect(r.status).toBe(200);
    expect((await r.json()).staged).toBe(300);
  });

  it('refuses rows the database must not see (decision "approved", bad phone, too many rows)', async () => {
    const url = '/api/poi/runs/11111111-1111-4111-8111-111111111111/rows';
    expect((await post(s.base, url, { rows: [{ ...row, decision: 'approved' }] }, TOKEN)).status).toBe(400);
    expect((await post(s.base, url, { rows: [{ ...row, phone: '0123' }] }, TOKEN)).status).toBe(400);
    expect((await post(s.base, url, { rows: Array.from({ length: 501 }, () => row) }, TOKEN)).status).toBe(400);
  });

  it('processes a run', async () => {
    const r = await post(s.base, '/api/poi/runs/11111111-1111-4111-8111-111111111111/process', {}, TOKEN);
    expect(r.status).toBe(200);
    expect(poiCalls().at(-1)).toEqual(['poi_process_run', { p_run: '11111111-1111-4111-8111-111111111111', p_force: false }]);
  });
});

describe('POI import API: a short token never works', () => {
  let s: { server: Server; base: string };
  beforeAll(async () => (s = await serve({ POI_IMPORT_ENABLED: 'true', POI_INGEST_TOKEN: 'short' })));
  afterAll(() => s.server.close());
  it('401 even with the right short token', async () => {
    expect((await post(s.base, '/api/poi/runs', {}, 'short')).status).toBe(401);
  });
});
