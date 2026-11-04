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
