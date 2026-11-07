import { describe, expect, it } from 'vitest';
import { normalizeFeature } from './mapbox.js';

describe('normalizeFeature', () => {
  it('maps a Search Box POI feature', () => {
    const place = normalizeFeature({
      geometry: { coordinates: [101.7116, 3.1579] },
      properties: {
        mapbox_id: 'abc',
        name: 'Suria KLCC',
        full_address: 'Suria KLCC, Jalan Ampang, 50088 Kuala Lumpur',
        feature_type: 'poi',
        poi_category: ['shopping mall'],
      },
    });
    expect(place).toEqual({
      id: 'abc',
      name: 'Suria KLCC',
      address: 'Jalan Ampang, 50088 Kuala Lumpur',
      coordinates: { lng: 101.7116, lat: 3.1579 },
      kind: 'poi',
      category: 'shopping mall',
      source: 'mapbox',
      distanceMeters: undefined,
    });
  });

  it('prefers properties.coordinates and handles unknown types', () => {
    const place = normalizeFeature({
      geometry: { coordinates: [0, 0] },
      properties: { name: '50088', feature_type: 'mystery', coordinates: { longitude: 101.7, latitude: 3.15 } },
    });
    expect(place?.coordinates).toEqual({ lng: 101.7, lat: 3.15 });
    expect(place?.kind).toBe('other');
  });

  it('drops features without coordinates or name', () => {
    expect(normalizeFeature({ properties: { name: 'x' } })).toBeNull();
    expect(normalizeFeature({ geometry: { coordinates: [1, 2] }, properties: {} })).toBeNull();
  });
});

describe('street search helpers', () => {
  it('spaces Malaysian street codes', async () => {
    const { spaceStreetCodes } = await import('./mapbox.js');
    expect(spaceStreetCodes('jalan cj7 taman changgang jaya')).toBe('jalan cj 7 taman changgang jaya');
    expect(spaceStreetCodes('SS2/24 Petaling Jaya')).toBe('SS 2/24 Petaling Jaya');
    expect(spaceStreetCodes('jalan ampang')).toBe('jalan ampang');
  });
  it('merges without duplicates', async () => {
    const { mergePlaces } = await import('./mapbox.js');
    const mk = (id: string, name: string, lat: number) => ({ id, name, address: '', coordinates: { lat, lng: 101.5 }, kind: 'poi' as const, source: 'mapbox' as const });
    const r = mergePlaces([mk('a', 'Jalan CJ 7', 2.8)], [mk('b', 'jalan cj 7', 2.9), mk('c', 'Near A', 2.8001), mk('d', 'Other', 2.95)], 8);
    expect(r.map((p) => p.id)).toEqual(['a', 'd']);
  });
});

describe('photonToPlace', () => {
  it('maps OSM streets in Malaysia and drops other countries', async () => {
    const { photonToPlace } = await import('./mapbox.js');
    expect(photonToPlace({ geometry: { coordinates: [101.56, 2.83] }, properties: { osm_id: 123, osm_type: 'W', name: 'Jalan CJ 7', type: 'street', district: 'Taman Changgang Jaya', city: 'Banting', postcode: '42700', state: 'Selangor', countrycode: 'MY' } })).toEqual({
      id: 'osm:W123', name: 'Jalan CJ 7', address: 'Taman Changgang Jaya, 42700 Banting, Selangor', coordinates: { lng: 101.56, lat: 2.83 }, kind: 'street', source: 'osm',
    });
    expect(photonToPlace({ geometry: { coordinates: [103.8, 1.3] }, properties: { name: 'Orchard Road', type: 'street', countrycode: 'SG' } })).toBeNull();
  });
});
