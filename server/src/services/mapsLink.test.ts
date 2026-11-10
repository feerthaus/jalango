import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMapsLink, parseGoogleMapsUrl, parseLatLng, placeFromMapsLink } from './mapsLink.js';

afterEach(() => vi.unstubAllGlobals());

describe('Google Maps links', () => {
  it('prefers the place pin over the map centre, and reads the name', () => {
    const r = parseGoogleMapsUrl('https://www.google.com/maps/place/Awana+SkyWay/@3.4036,101.7829,17z/data=!3m1!4b1!4m6!3m5!1s0x31cc:0x1!8m2!3d3.4035612!4d101.7832231!16s%2Fg%2F11');
    expect(r).toEqual({ coordinates: { lat: 3.4035612, lng: 101.7832231 }, name: 'Awana SkyWay' });
  });
  it('reads ?q=lat,lng and ?query=name', () => {
    expect(parseGoogleMapsUrl('https://maps.google.com/?q=3.1579,101.7116')?.coordinates).toEqual({ lat: 3.1579, lng: 101.7116 });
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Awana+Skyway%2C+Genting')).toEqual({ name: 'Awana Skyway' });
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
});
