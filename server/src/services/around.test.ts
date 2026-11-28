import { describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabaseAdmin.js', () => ({ supabaseAdmin: { rpc } }));
vi.mock('../config.js', () => ({ config: { mapboxToken: null, corsOrigins: [], port: 0, supabaseUrl: null, supabaseServiceRoleKey: null }, integrations: {} }));

import { placesAround, toAround } from './around.js';
import { aroundQuery } from '../routes/geocoding.js';

describe('Sekitar sini', () => {
  it('maps community picks and POIs to app places, never inventing ratings', () => {
    expect(toAround({ id: 'c1', source: 'komuniti', name: 'Nasi Lemak Mak Ani', note: 'Sambal pedas', lat: 2.81, lng: 101.5, distance_m: 228, recommends: 5, confirmations: 0, verification: null })).toEqual({
      id: 'community:c1', name: 'Nasi Lemak Mak Ani', note: 'Sambal pedas', source: 'komuniti', lat: 2.81, lng: 101.5, distanceMeters: 228, recommends: 5, confirmations: 0, unverified: false,
    });
    const p = toAround({ id: 'p1', source: 'poi', name: 'Restoran Dekat', note: 'restoran', lat: 2.81, lng: 101.5, distance_m: 11, recommends: 0, confirmations: 2, verification: 'belum' });
    expect(p).toMatchObject({ id: 'poi:p1', unverified: true, confirmations: 2 });
    expect(Object.keys(p)).not.toContain('rating');
  });
  it('asks the database for the kind and radius', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await placesAround({ lat: 2.81, lng: 101.5 }, 'menarik', 2000, 5);
    expect(rpc).toHaveBeenCalledWith('places_around', { p_lat: 2.81, p_lng: 101.5, p_kind: 'menarik', p_radius: 2000, p_limit: 5 });
  });
  it('validates the query', () => {
    expect(aroundQuery.parse({ kind: 'makan', lat: '2.81', lng: '101.5' })).toEqual({ kind: 'makan', lat: 2.81, lng: 101.5, radius: 3000 });
    expect(() => aroundQuery.parse({ kind: 'judi', lat: '2.81', lng: '101.5' })).toThrow();
    expect(() => aroundQuery.parse({ kind: 'makan', lat: '40', lng: '101.5' })).toThrow();
  });
});
