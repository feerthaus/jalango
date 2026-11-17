import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../types.js';

const google = vi.hoisted(() => ({ enabled: false, find: vi.fn() }));
const mapbox = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('./googlePlaces.js', () => ({ googlePlacesEnabled: () => google.enabled, googleFindPlace: google.find }));
vi.mock('./mapbox.js', async (orig) => ({ ...(await orig<typeof import('./mapbox.js')>()), searchPlaces: mapbox.search }));

import { isMapsLink, parseGoogleMapsUrl, parseLatLng, placeFromMapsLink, placeName } from './mapsLink.js';

afterEach(() => {
  vi.unstubAllGlobals();
  google.enabled = false;
  google.find.mockReset();
  mapbox.search.mockReset();
});

const place = (name: string, lat: number, lng: number, source: Place['source'] = 'mapbox'): Place => ({ id: name, name, address: '', coordinates: { lat, lng }, kind: 'poi', source });
// What an iPhone "Share" link from Google Maps expands to: name and address, no coordinates
const SHARE = 'https://maps.google.com/?q=Celik+Mata+Optometry+HQ,+No+19+G,+Jalan+CyberSouth+1,+Cybersouth,+43800+Dengkil,+Selangor&ftid=0x31cdb5:0x1&entry=gps&g_st=ic';
const shortTo = (location: string) => vi.stubGlobal('fetch', async () => new Response(null, { status: 302, headers: { location } }));

describe('Google Maps links', () => {
  it('prefers the place pin over the map centre, and reads the name', () => {
    const r = parseGoogleMapsUrl('https://www.google.com/maps/place/Awana+SkyWay/@3.4036,101.7829,17z/data=!3m1!4b1!4m6!3m5!1s0x31cc:0x1!8m2!3d3.4035612!4d101.7832231!16s%2Fg%2F11');
    expect(r).toEqual({ coordinates: { lat: 3.4035612, lng: 101.7832231 }, name: 'Awana SkyWay' });
  });
  it('reads ?q=lat,lng and ?query=name', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=3.1579,101.7116')?.coordinates).toEqual({ lat: 3.1579, lng: 101.7116 });
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Awana+Skyway%2C+Genting')).toEqual({ name: 'Awana Skyway', query: 'Awana Skyway, Genting' });
  });
  it('unwraps the consent page', () => {
    const inner = encodeURIComponent('https://www.google.com/maps/place/KLCC/@3.1579,101.7116,15z');
    expect(parseGoogleMapsUrl(`https://consent.google.com/m?continue=${inner}`)?.coordinates).toEqual({ lat: 3.1579, lng: 101.7116 });
  });
  it('recognises links and typed coordinates only', () => {
    expect(isMapsLink('https://maps.app.goo.gl/abc123')).toBe(true);
    expect(isMapsLink('https://www.google.com/maps/place/X/@3.1,101.7,15z')).toBe(true);
    expect(isMapsLink('https://evil.example.com/maps')).toBe(false);
    expect(isMapsLink('Awana Skyway')).toBe(false);
    expect(parseLatLng('3.4036, 101.7829')).toEqual({ lat: 3.4036, lng: 101.7829 });
    expect(parseLatLng('KL 3')).toBeNull();
  });
  it('follows a short link through Google redirects only', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL) => {
      seen.push(String(input));
      return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Awana+SkyWay/@3.40,101.78,17z/data=!3d3.4035612!4d101.7832231' } });
    });
    const p = await placeFromMapsLink('https://maps.app.goo.gl/abc123');
    expect(seen).toEqual(['https://maps.app.goo.gl/abc123']);
    expect(p).toMatchObject({ name: 'Awana SkyWay', coordinates: { lat: 3.403561, lng: 101.783223 }, source: 'link' });
  });
  it('refuses redirects that leave Google', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }));
    expect(await placeFromMapsLink('https://maps.app.goo.gl/abc123')).toBeNull();
  });
  it('ignores places outside Malaysia', async () => {
    expect(await placeFromMapsLink('https://www.google.com/maps/place/Eiffel/@48.858,2.294,17z')).toBeNull();
  });

  it('finds the name when the share link puts the unit number first', () => {
    // the owner's real link (17 Nov 2026), trimmed
    const real = 'https://maps.google.com/?q=No+19+G,+Celik+Mata+Optometry+HQ,+Park+Place+1+Cybersouth,+Park+Place+1,+43800+Dengkil,+Selangor&ftid=0x31cc9f7db32da8fb:0xd6ed70dfe05e4080&entry=gps&g_st=ic';
    expect(parseGoogleMapsUrl(real)).toEqual({ name: 'Celik Mata Optometry HQ', query: 'No 19 G, Celik Mata Optometry HQ, Park Place 1 Cybersouth, Park Place 1, 43800 Dengkil, Selangor' });
    expect(placeName('Lot 5, Jalan Ampang, KLCC')).toBe('KLCC');
    expect(placeName('Awana SkyWay')).toBe('Awana SkyWay');
    expect(placeName('No 3, Jalan 1')).toBe('No 3');
  });
  it('keeps the full place text of a share link without coordinates', () => {
    expect(parseGoogleMapsUrl(SHARE)).toEqual({ name: 'Celik Mata Optometry HQ', query: 'Celik Mata Optometry HQ, No 19 G, Jalan CyberSouth 1, Cybersouth, 43800 Dengkil, Selangor' });
  });
  it('places a name-only share link with Google, using name and address', async () => {
    shortTo(SHARE);
    google.enabled = true;
    google.find.mockResolvedValue(place('Celik Mata Optometry HQ', 2.8692, 101.66, 'google'));
    const p = await placeFromMapsLink('https://maps.app.goo.gl/Xh97?g_st=ic', { lat: 5.47, lng: 100.49 });
    expect(google.find).toHaveBeenCalledWith('Celik Mata Optometry HQ, No 19 G, Jalan CyberSouth 1, Cybersouth, 43800 Dengkil, Selangor', { lat: 5.47, lng: 100.49 });
    expect(p).toMatchObject({ name: 'Celik Mata Optometry HQ', source: 'google' });
    expect(mapbox.search).not.toHaveBeenCalled();
  });
  it('never returns a lookalike: a street named "Lorong 19" is not the shop', async () => {
    shortTo(SHARE);
    mapbox.search.mockResolvedValue([place('Lorong 19', 5.478, 100.488, 'osm')]);
    expect(await placeFromMapsLink('https://maps.app.goo.gl/Xh97')).toBeNull();
  });
  it('falls back to our own search when Google is off or wrong, matching the name', async () => {
    shortTo(SHARE);
    google.enabled = true;
    google.find.mockResolvedValue(place('Kedai Lain', 2.9, 101.7, 'google'));
    mapbox.search.mockResolvedValue([place('Kacha Mata Optometry', 2.92, 101.68), place('Celik Mata Optometry HQ', 2.8692, 101.66)]);
    expect(await placeFromMapsLink('https://maps.app.goo.gl/Xh97')).toMatchObject({ name: 'Celik Mata Optometry HQ', source: 'mapbox' });
  });
  it('still works when the Google call fails', async () => {
    shortTo(SHARE);
    google.enabled = true;
    google.find.mockRejectedValue(new Error('quota'));
    mapbox.search.mockResolvedValue([place('Celik Mata Optometry HQ', 2.8692, 101.66)]);
    expect(await placeFromMapsLink('https://maps.app.goo.gl/Xh97')).toMatchObject({ name: 'Celik Mata Optometry HQ' });
  });
});
