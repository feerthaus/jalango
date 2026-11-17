import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: { mapboxToken: 'test-token', corsOrigins: [], port: 0, supabaseUrl: null, supabaseServiceRoleKey: null }, integrations: {} }));
// the usage counter also goes through rpc: answer it with a small number
const rpc = vi.hoisted(() => vi.fn(async (_fn: string, _args?: unknown) => ({ data: 1, error: null })));
vi.mock('../lib/supabaseAdmin.js', () => ({ supabaseAdmin: { rpc, from: () => { throw new Error('not in tests'); } } }));

import { logMiss, matchLearnedPlaces, setLearned, smartSearch } from './searchLearning.js';
import { searchMissSchema } from '../routes/geocoding.js';

let n = 0;
const feat = (name: string) => ({ geometry: { coordinates: [101.5 + (n += 0.01), 3] }, properties: { mapbox_id: name, name, full_address: 'Somewhere', feature_type: 'poi' } });
const station = { id: 'jalango:1', name: 'Stesen KTMB Gemas', address: 'Gemas', coordinates: { lat: 2.58, lng: 102.61 }, kind: 'poi' as const, source: 'jalango' as const, keywords: ['ktm gemas'] };

afterEach(() => {
  vi.unstubAllGlobals();
  setLearned(null);
  rpc.mockClear();
});

describe('search that learns', () => {
  it('matches JalanGo places by name or keywords', () => {
    expect(matchLearnedPlaces([station], 'ktm gemas').map((p) => p.name)).toEqual(['Stesen KTMB Gemas']);
    expect(matchLearnedPlaces([station], 'stesen gem')).toHaveLength(1);
    expect(matchLearnedPlaces([station], 'ktm kajang')).toHaveLength(0);
    expect(matchLearnedPlaces([station], 'ktm gemas')[0]).not.toHaveProperty('keywords');
    // a single common word doesn't pin it
    expect(matchLearnedPlaces([station], 'stesen')).toHaveLength(0);
    expect(matchLearnedPlaces([station], 'ktm')).toHaveLength(0);
  });

  it('puts the admin\'s place first, with its distance', async () => {
    setLearned({ synonyms: {}, places: [station], redirects: [] });
    vi.stubGlobal('fetch', async () => Response.json({ features: [feat('Ktm Mart'), feat('Nasi Ayam Gemas')] }));
    const r = await smartSearch('ktm gemas', { lat: 3, lng: 101.7 });
    expect(r[0]).toMatchObject({ name: 'Stesen KTMB Gemas', source: 'jalango' });
    expect(r[0].distanceMeters).toBeGreaterThan(100_000);
  });

  it('tries admin synonyms before the built-in ones', async () => {
    setLearned({ synonyms: { pdrm: ['balai polis'] }, places: [], redirects: [] });
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      const q = new URL(String(u)).searchParams.get('q') ?? '';
      asked.push(q);
      return Response.json({ features: q === 'balai polis kajang' ? [feat('Balai Polis Kajang')] : [feat('Kedai Kajang')] });
    });
    const r = await smartSearch('pdrm kajang', undefined);
    expect(asked).toContain('balai polis kajang');
    expect(r.map((p) => p.name)).toContain('Balai Polis Kajang');
  });

  it('counts a search that found nothing, and nothing else', async () => {
    setLearned({ synonyms: {}, places: [], redirects: [] });
    vi.stubGlobal('fetch', async () => Response.json({ features: [] }));
    expect(await smartSearch('zzqx nowhere', undefined)).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('log_search_miss', expect.objectContaining({ p_query: 'zzqx nowhere', p_kind: 'no_results' }));
    rpc.mockClear();
    vi.stubGlobal('fetch', async () => Response.json({ features: [feat('KFC Kajang')] }));
    await smartSearch('kfc kajang', undefined);
    expect(rpc).not.toHaveBeenCalledWith('log_search_miss', expect.anything());
  });

  it('logs a report with its note and the place the user pointed to', async () => {
    await logMiss('Ktm gemas', 'reported', { note: 'stesen keretapi', hint: { name: 'Stesen KTMB Gemas', lat: 2.58, lng: 102.61 } });
    expect(rpc).toHaveBeenCalledWith('log_search_miss', { p_query: 'Ktm gemas', p_kind: 'reported', p_note: 'stesen keretapi', p_hint_name: 'Stesen KTMB Gemas', p_hint_lat: 2.58, p_hint_lng: 102.61 });
  });

  it('accepts only short text and no "no_results" from the app', () => {
    expect(searchMissSchema.safeParse({ query: 'ktm gemas', kind: 'reported', note: 'x' }).success).toBe(true);
    expect(searchMissSchema.safeParse({ query: 'ktm gemas', kind: 'no_results' }).success).toBe(false);
    expect(searchMissSchema.safeParse({ query: 'k', kind: 'no_click' }).success).toBe(false);
    expect(searchMissSchema.safeParse({ query: 'a'.repeat(121), kind: 'no_click' }).success).toBe(false);
  });

  it('a pinned result is looked up again by its saved text and put first (nothing from Mapbox stored)', async () => {
    setLearned({ synonyms: {}, places: [], redirects: [{ keywords: ['ktm gemas'], targetName: 'Stesen KTMB Gemas', targetQuery: 'stesen ktmb gemas' }] });
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      const q = new URL(String(u)).searchParams.get('q') ?? '';
      asked.push(q);
      if (q === 'stesen ktmb gemas') return Response.json({ features: [feat('Belakang stesen KTMB Gemas'), feat('Stesen KTMB Gemas')] });
      return Response.json({ features: [feat('Gemas'), feat('Ktm Mart'), feat('Nasi Ayam Gemas')] });
    });
    const r = await smartSearch('Ktm gemas', undefined);
    expect(asked).toContain('stesen ktmb gemas');
    expect(r[0]).toMatchObject({ name: 'Stesen KTMB Gemas', pinned: true, source: 'mapbox' });
    // other searches with "ktm" alone don't follow it
    asked.length = 0;
    await smartSearch('ktm kajang', undefined);
    expect(asked).not.toContain('stesen ktmb gemas');
  });
});
