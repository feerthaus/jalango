import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: { mapboxToken: 'test-token', corsOrigins: [], port: 0, supabaseUrl: null, supabaseServiceRoleKey: null }, integrations: {} }));

import { matchScore, queryVariants, rankByMatch, searchPlaces } from './mapbox.js';
import type { Place } from '../types.js';

let n = 0;
const feat = (name: string, address: string, id = name) => ({ geometry: { coordinates: [102.6 + (n += 0.01), 2.58] }, properties: { mapbox_id: id, name, full_address: address, feature_type: 'poi' } });
const place = (name: string, address = ''): Place => ({ id: name, name, address, coordinates: { lat: 3, lng: 101 }, kind: 'poi', source: 'mapbox' });

afterEach(() => vi.unstubAllGlobals());

describe('search relevance', () => {
  it('knows Malaysian alternatives for transit and place words', () => {
    expect(queryVariants('Ktm gemas')).toEqual(['stesen ktmb gemas', 'ktm station gemas']);
    expect(queryVariants('lrt ampang')[0]).toBe('stesen lrt ampang');
    expect(queryVariants('hosp serdang')).toEqual(['hospital serdang']);
    expect(queryVariants('Celik Mata')).toEqual([]);
  });

  it('scores name matches above address matches', () => {
    expect(matchScore(place('Stesen KTMB Gemas', 'Gemas, 73400'), 'ktm gemas')).toBe(2);
    expect(matchScore(place('KTM', 'Gemas, Negeri Sembilan'), 'ktm gemas')).toBe(1);
    expect(matchScore(place('Ktm Mart', 'Kulai'), 'ktm gemas')).toBe(0);
    expect(matchScore(place("McDonald's"), 'mcdonald')).toBe(2);
  });

  it('puts full matches first and keeps the order otherwise', () => {
    const r = rankByMatch([place('Gemas'), place('Ktm Mart'), place('KTM', 'Gemas'), place('Stesen KTMB Gemas')], 'ktm gemas');
    expect(r.map((p) => p.name)).toEqual(['Stesen KTMB Gemas', 'KTM', 'Gemas', 'Ktm Mart']);
    expect(rankByMatch([place('B'), place('A')], 'zzz').map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('"Ktm gemas" finds Stesen KTMB Gemas through the alternatives and lists it first', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      const url = new URL(String(u));
      const q = url.searchParams.get('q') ?? '';
      asked.push(q);
      if (url.hostname.includes('photon')) return Response.json({ features: [] });
      if (q === 'stesen ktmb gemas') return Response.json({ features: [feat('Stesen KTMB Gemas', 'Gemas, 73400, Malaysia'), feat('Gemas', 'Negeri Sembilan, Malaysia')] });
      if (q === 'Ktm gemas') return Response.json({ features: [feat('Gemas', 'Negeri Sembilan, Malaysia'), feat('Nasi Ayam Gemas', 'Kajang'), feat('Ktm Mart', 'Kulai')] });
      return Response.json({ features: [] });
    });
    const r = await searchPlaces('Ktm gemas');
    expect(r[0].name).toBe('Stesen KTMB Gemas');
    expect(r.filter((p) => p.name === 'Gemas')).toHaveLength(1);
    expect(asked).toContain('stesen ktmb gemas');
  });

  it('asks nothing extra when a top result already matches every word', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      asked.push(new URL(String(u)).searchParams.get('q') ?? '');
      return Response.json({ features: [feat('Stesen KTMB Gemas', 'Gemas'), feat('Gemas', 'Negeri Sembilan'), feat('Kereta Sewa Gemas', 'Gemas')] });
    });
    const r = await searchPlaces('stesen gemas');
    expect(r[0].name).toBe('Stesen KTMB Gemas');
    expect(asked).toEqual(['stesen gemas']);
  });
});
