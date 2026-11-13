import { describe, expect, it } from 'vitest';
import { placeFromParams, placeUrl } from './placeLink';

describe('placeLink', () => {
  it('round-trips a place through the URL', () => {
    const url = placeUrl({ name: 'Poliklinik Nur Fatimah', address: '141, Jalan LU 2/2 Taman Langat Utama, Banting', coordinates: { lat: 2.800608, lng: 101.656348 } }, 'https://jalango.netlify.app');
    expect(url).toBe('https://jalango.netlify.app/?tempat=2.800608%2C101.656348&n=Poliklinik+Nur+Fatimah&a=141%2C+Jalan+LU+2%2F2+Taman+Langat+Utama%2C+Banting');
    const p = placeFromParams(new URL(url).searchParams)!;
    expect(p.name).toBe('Poliklinik Nur Fatimah');
    expect(p.address).toContain('Banting');
    expect(p.coordinates).toEqual({ lat: 2.800608, lng: 101.656348 });
  });
  it('rejects bad coordinates and fills defaults', () => {
    expect(placeFromParams(new URLSearchParams('tempat=abc'))).toBeNull();
    expect(placeFromParams(new URLSearchParams('tempat=95,10'))).toBeNull();
    expect(placeFromParams(new URLSearchParams(''))).toBeNull();
    expect(placeFromParams(new URLSearchParams('tempat=3.1,101.6'))?.name).toBe('Lokasi dikongsi');
  });
});
