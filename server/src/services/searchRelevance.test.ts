import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({ config: { mapboxToken: 'test-token', corsOrigins: [], port: 0, supabaseUrl: null, supabaseServiceRoleKey: null }, integrations: {} }));

import { matchScore, parentStreet, queryVariants, rankByMatch, searchPlaces, streetCodes } from './mapbox.js';
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

  it('reads Malaysian street codes and the main road of a side road', () => {
    expect(streetCodes('Jalan P9C/1')).toEqual(['p9c']);
    expect(streetCodes('No 12 Jalan SS 2/24 PJ')).toEqual(['ss2']);
    expect(streetCodes('Lot 1234 Kg Baru')).toEqual([]);
    expect(parentStreet('Jalan P9C/1')).toBe('Jalan P9C');
    expect(parentStreet('jalan ss2/24 petaling jaya')).toBe('jalan ss2 petaling jaya');
    expect(parentStreet('Jalan Tun Razak')).toBeNull();
  });

  it('"Jalan P9C/1" (Putrajaya): no "Jalan KLIA 1" on top; the main road Jalan P9C first', async () => {
    const asked: string[] = [];
    const geo = (name: string, kind: string, lng: number, lat: number) => ({ geometry: { coordinates: [lng, lat] }, properties: { mapbox_id: name, name, full_address: `${name}, Putrajaya, 62250, Malaysia`, feature_type: kind } });
    vi.stubGlobal('fetch', async (u: URL) => {
      const url = new URL(String(u));
      const q = url.searchParams.get('q') ?? '';
      asked.push(`${url.hostname.includes('photon') ? 'osm' : url.pathname.includes('geocode') ? 'geo' : 'box'}:${q}`);
      if (url.hostname.includes('photon')) {
        return Response.json({ features: [
          { geometry: { coordinates: [101.677, 2.7915] }, properties: { name: 'Jalan KLIA 1', osm_key: 'highway', osm_value: 'secondary', city: 'Sepang', state: 'Selangor', country: 'Malaysia', osm_id: 1, osm_type: 'W' } },
        ] });
      }
      if (url.pathname.includes('geocode') && q === 'Jalan P9C') return Response.json({ features: [geo('Jalan P9c', 'street', 101.6765, 2.9385)] });
      if (url.pathname.includes('geocode')) return Response.json({ features: [] });
      return Response.json({ features: [feat('Blok C, Fasa 10 Jalan P9C', 'Jalan P9c, Putrajaya, 62250, Malaysia'), feat('107, Jalan MR 1', 'Cyberjaya, 63000, Malaysia'), feat('Jalan Alamanda 1 Garage', 'Putrajaya, 62000, Malaysia')] });
    });
    const r = await searchPlaces('Jalan P9C/1', { lat: 2.93, lng: 101.69 });
    expect(r[0].name).toBe('Jalan P9c');
    expect(r[1].name).toBe('Blok C, Fasa 10 Jalan P9C');
    expect(r.map((p) => p.name)).not.toContain('Jalan KLIA 1');
    expect(asked).toContain('geo:Jalan P9C');
  });
});
