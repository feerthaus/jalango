import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));

import { fetchNearbyUnverified, myPoiFeedback, poiIdOf, sendPoiFeedback } from './poiFeedbackService';

const ID = '0b8f7a7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
beforeEach(() => rpc.mockReset());

describe('POI community checks', () => {
  it('only JalanGo POI places get the check', () => {
    expect(poiIdOf(`poi:${ID}`)).toBe(ID);
    expect(poiIdOf('osm:N123')).toBeNull();
    expect(poiIdOf('mapbox:abc')).toBeNull();
    expect(poiIdOf('poi:not-a-uuid')).toBeNull();
  });
  it('sends the answer with a rounded position (the database keeps only "near")', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await sendPoiFeedback(ID, 'sudah_tutup', { lat: 2.812345678, lng: 101.501234567 })).toBe(true);
    expect(rpc).toHaveBeenCalledWith('poi_submit_feedback', { p_poi: ID, p_kind: 'sudah_tutup', p_lat: 2.81235, p_lng: 101.50123, p_suggested_name: null, p_suggested_category: null });
    await sendPoiFeedback(ID, 'nama_dicadangkan', null, '  Haiza   Auto  ');
    expect(rpc).toHaveBeenLastCalledWith('poi_submit_feedback', { p_poi: ID, p_kind: 'nama_dicadangkan', p_lat: null, p_lng: null, p_suggested_name: 'Haiza Auto', p_suggested_category: null });
  });
  it('reports the daily limit, and reads my earlier answers', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Too many answers today.', hint: 'rate_limited' } });
    await expect(sendPoiFeedback(ID, 'masih_beroperasi', null)).rejects.toThrow('rate_limited');
    rpc.mockResolvedValue({ data: { answered: ['masih_beroperasi'], verification: 'disahkan_komuniti' }, error: null });
    expect(await myPoiFeedback(ID)).toEqual({ answered: ['masih_beroperasi'], verification: 'disahkan_komuniti' });
  });
  it('asks for unconfirmed places nearby with a rounded position', async () => {
    rpc.mockResolvedValue({ data: [{ id: ID, name: 'Klinik Anda', category: 'kesihatan', lat: 2.96, lng: 101.75, distance_m: 120 }], error: null });
    expect((await fetchNearbyUnverified({ lat: 2.963184567, lng: 101.756321234 }))[0].name).toBe('Klinik Anda');
    expect(rpc).toHaveBeenCalledWith('nearby_unverified_pois', { p_lat: 2.96318, p_lng: 101.75632 });
  });
});
