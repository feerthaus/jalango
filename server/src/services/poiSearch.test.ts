import { afterEach, describe, expect, it, vi } from 'vitest';

const cfg = vi.hoisted(() => ({ poiSearchEnabled: true }));
vi.mock('../config.js', () => ({ config: cfg }));
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabaseAdmin.js', () => ({ supabaseAdmin: { rpc } }));

import { keepNameMatches, parsePoiQuery, searchPois, settleWithin, toPlace, withPois } from './poiSearch.js';

const row = { id: 'a1', name: 'Haiza Workshop', category: 'bengkel' as const, subcategory: 'bengkel kereta', lat: 2.81, lng: 101.5, address: null, nearest_place: 'Banting', distance_m: 120 };

afterEach(() => {
  rpc.mockReset();
  cfg.poiSearchEnabled = true;
  vi.useRealTimers();
});

describe('POI query', () => {
  it('reads "category [place]" searches', () => {
    expect(parsePoiQuery('bengkel banting')).toEqual({ q: null, category: 'bengkel', word: null, place: 'banting' });
    expect(parsePoiQuery('Bengkel di Banting')).toEqual({ q: null, category: 'bengkel', word: null, place: 'banting' });
    expect(parsePoiQuery('surau')).toEqual({ q: null, category: 'ibadah', word: 'surau', place: null });
    expect(parsePoiQuery('masjid jenjarom')).toEqual({ q: null, category: 'ibadah', word: 'masjid', place: 'jenjarom' });
    expect(parsePoiQuery('kedai makan dekat morib')).toEqual({ q: null, category: 'restoran', word: null, place: 'morib' });
    expect(parsePoiQuery('stesen minyak')).toMatchObject({ category: 'minyak', place: null });
  });
  it('treats anything else as a name', () => {
    expect(parsePoiQuery('Restoran K2')).toEqual({ q: 'restoran k2', category: null, word: null, place: null });
    expect(parsePoiQuery('Surau Al-Hidayah Taman Sri Jaromas')).toMatchObject({ category: null });
    expect(parsePoiQuery('Lotus’s Banting')).toMatchObject({ q: "lotus's banting", category: null });
    expect(parsePoiQuery('x')).toEqual({ q: null, category: null, word: null, place: null });
  });
});

describe('POI search', () => {
  it('maps database rows to places with OpenStreetMap as the source', () => {
    expect(toPlace(row)).toEqual({ id: 'poi:a1', name: 'Haiza Workshop', address: 'Banting, Kuala Langat, Selangor', coordinates: { lat: 2.81, lng: 101.5 }, kind: 'poi', category: 'car_repair', source: 'osm', distanceMeters: 120 });
  });
  it('calls search_pois with the parsed query and location', async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    const out = await searchPois('bengkel banting', { lat: 2.8, lng: 101.49 }, 8);
    expect(out.map((p) => p.name)).toEqual(['Haiza Workshop']);
    expect(rpc).toHaveBeenCalledWith('search_pois', { p_q: null, p_category: 'bengkel', p_word: null, p_place: 'banting', p_lat: 2.8, p_lng: 101.49, p_limit: 8 });
  });
  it('is off unless switched on', async () => {
    cfg.poiSearchEnabled = false;
    expect(await searchPois('bengkel banting', undefined, 8)).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('never breaks or slows search: errors and slow answers give no POIs', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await searchPois('restoran k2', undefined, 8)).toEqual([]);
    vi.useFakeTimers();
    rpc.mockReturnValue(new Promise(() => {}));
    const slow = searchPois('restoran k2', undefined, 8);
    await vi.advanceTimersByTimeAsync(1501);
    expect(await slow).toEqual([]);
  });
  it('category searches list POIs first; name searches only the best two', () => {
    const p = [1, 2, 3].map((i) => toPlace({ ...row, id: String(i) }));
    expect(withPois(p, 'bengkel banting').first).toHaveLength(3);
    expect(withPois(p, 'haiza')).toMatchObject({ first: [{ id: 'poi:1' }, { id: 'poi:2' }], after: [{ id: 'poi:3' }] });
  });
  it('name search keeps places with the distinctive word (production: "restoran k2" listed 6 other restaurants)', () => {
    const rows = ['Restoran K2', 'Restoran K2', 'Restoran TWW', 'Restoran Kian Heng', 'Restoran Kak Leha'].map((name) => ({ name }));
    expect(keepNameMatches(rows, 'restoran k2').map((r) => r.name)).toEqual(['Restoran K2', 'Restoran K2']);
    expect(keepNameMatches(rows, 'restoren k2').map((r) => r.name)).toEqual(['Restoran K2', 'Restoran K2']);
    // only kind words: nothing distinctive to filter on
    expect(keepNameMatches(rows, 'restoran')).toHaveLength(5);
    // a typo that matches no name keeps the close spellings
    expect(keepNameMatches([{ name: 'Haiza Workshop' }], 'hazia')).toHaveLength(1);
  });
  it('applies the name filter to database rows', async () => {
    rpc.mockResolvedValue({ data: [row, { ...row, id: 'b2', name: 'Restoran TWW', category: 'restoran' }], error: null });
    expect((await searchPois('haiza auto', undefined, 8)).map((p) => p.name)).toEqual(['Haiza Workshop']);
  });
  it('waits for POIs only a short grace after Mapbox (production: the database answered in 330–718 ms)', async () => {
    vi.useFakeTimers();
    const at = (ms: number) => new Promise<string[]>((r) => setTimeout(() => r(['poi']), ms));
    const quick = settleWithin(at(200), 300);
    await vi.advanceTimersByTimeAsync(200);
    expect(await quick).toEqual(['poi']);
    const late = settleWithin(at(900), 300);
    await vi.advanceTimersByTimeAsync(300);
    expect(await late).toEqual([]);
    expect(await settleWithin(Promise.reject(new Error('x')), 300)).toEqual([]);
  });
});
