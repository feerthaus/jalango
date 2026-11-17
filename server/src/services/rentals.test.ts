import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../types.js';

const mb = vi.hoisted(() => ({ category: vi.fn() }));
vi.mock('./mapbox.js', async (orig) => ({ ...(await orig<typeof import('./mapbox.js')>()), searchCategory: mb.category }));

import { isGenericName, mergeNew, searchRentals } from './rentals.js';

const near = { lat: 3.0, lng: 101.5 };
const place = (name: string, lat: number, lng: number): Place => ({ id: name, name, address: '', coordinates: { lat, lng }, kind: 'poi', source: 'mapbox' });
const feature = (name: string, lat: number, lng: number, id = 1) => ({ geometry: { coordinates: [lng, lat] }, properties: { osm_id: id, osm_type: 'N', name, countrycode: 'MY', city: 'Shah Alam' } });

afterEach(() => {
  vi.unstubAllGlobals();
  mb.category.mockReset();
});

describe('nearby homestays and car rentals', () => {
  it('uses Mapbox alone when it finds enough named places (no other call)', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    mb.category.mockResolvedValue(['A', 'B', 'C', 'D', 'E'].map((n, i) => place(`Homestay ${n}`, 3 + i / 1000, 101.5)));
    expect(await searchRentals('homestay', near)).toHaveLength(5);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fills in from OpenStreetMap: within 25 km, nearest first, no generic names, no duplicates', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => {
      urls.push(String(u));
      return Response.json({ features: [feature('Teratak Bonda', 3.01, 101.5, 1), feature('Homestay', 3.0, 101.51, 2), feature('Far Away Stay', 3.5, 101.5, 3), feature('Laman Kita', 3.002, 101.5, 4)] });
    });
    mb.category.mockResolvedValue([place('Laman Kita', 3.002, 101.5)]);
    const r = await searchRentals('homestay', near);
    expect(r.map((p) => p.name)).toEqual(['Laman Kita', 'Teratak Bonda']);
    expect(r[1]).toMatchObject({ source: 'osm', kind: 'poi' });
    expect(urls[0]).toContain('photon.komoot.io');
    expect(urls[0]).toContain('osm_tag=tourism%3Aguest_house');
    expect(urls.some((u) => u.includes('googleapis'))).toBe(false);
  });

  it('car rental asks OSM for amenity=car_rental in English and Malay', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (u: URL) => (urls.push(String(u)), Response.json({ features: [feature('Sewa Kereta Ali', 3.01, 101.5)] })));
    mb.category.mockResolvedValue([]);
    const r = await searchRentals('car_rental', near);
    expect(r.map((p) => p.name)).toEqual(['Sewa Kereta Ali']);
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.includes('osm_tag=amenity%3Acar_rental'))).toBe(true);
  });

  it('still answers when one side fails', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ features: [feature('Teratak Bonda', 3.01, 101.5)] }));
    mb.category.mockRejectedValue(new Error('mapbox down'));
    expect((await searchRentals('homestay', near)).map((p) => p.name)).toEqual(['Teratak Bonda']);
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }));
    await expect(searchRentals('homestay', near)).rejects.toThrow('mapbox down');
  });

  it('helpers', () => {
    expect(isGenericName('Kereta Sewa')).toBe(true);
    expect(isGenericName('Kereta Sewa Kota Bharu')).toBe(false);
    expect(mergeNew([place('A', 3, 101)], [place('A', 3.5, 101)])).toHaveLength(2);
  });
});
