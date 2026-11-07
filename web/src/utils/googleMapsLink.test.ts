import { describe, expect, it } from 'vitest';
import { googleMapsReviewsUrl } from './googleMapsLink';

describe('googleMapsReviewsUrl', () => {
  it('uses name and address', () => {
    const u = new URL(googleMapsReviewsUrl({ name: 'Ikan Bakar Pak Abu', address: 'Parit Jawa, Muar', coordinates: { lat: 2.05, lng: 102.62 } }));
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('query')).toBe('Ikan Bakar Pak Abu, Parit Jawa, Muar');
  });
  it('falls back to coordinates', () => {
    const u = new URL(googleMapsReviewsUrl({ name: 'R&R Ayer Keroh', address: '', coordinates: { lat: 2.27, lng: 102.3 } }));
    expect(u.searchParams.get('query')).toBe('R&R Ayer Keroh near 2.27000,102.30000');
  });
});
