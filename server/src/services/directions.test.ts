import { describe, expect, it } from 'vitest';
import { normalizeRoute } from './directions.js';

const fixture = {
  distance: 12_345,
  duration: 900,
  duration_typical: 780,
  geometry: {
    type: 'LineString' as const,
    coordinates: [
      [101.68, 3.13],
      [101.69, 3.14],
      [101.7, 3.15],
    ] as [number, number][],
  },
  legs: [
    {
      summary: 'E37, Jalan Tun Razak',
      annotation: { congestion: ['low', 'heavy'] },
      steps: [
        {
          distance: 10_000,
          duration: 700,
          name: 'Lebuhraya Duta-Ulu Kelang',
          ref: 'E33',
          maneuver: { type: 'depart', instruction: 'Drive north', location: [101.68, 3.13] as [number, number], bearing_after: 10 },
          intersections: [{ classes: ['toll', 'motorway'] }],
        },
        {
          distance: 2345,
          duration: 200,
          name: '',
          maneuver: { type: 'arrive', instruction: 'You have arrived', location: [101.7, 3.15] as [number, number] },
        },
      ],
    },
  ],
};

describe('normalizeRoute', () => {
  it('maps a Mapbox route', () => {
    const r = normalizeRoute(fixture, 0);
    expect(r.distanceMeters).toBe(12_345);
    expect(r.typicalDurationSeconds).toBe(780);
    expect(r.summary).toBe('E37, Jalan Tun Razak');
    expect(r.hasTolls).toBe(true);
    expect(r.hasMotorway).toBe(true);
    expect(r.congestion).toEqual(['low', 'heavy']);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]).toMatchObject({ roadName: 'Lebuhraya Duta-Ulu Kelang', roadRef: 'E33', maneuver: { location: { lng: 101.68, lat: 3.13 } } });
    expect(r.steps[1].roadName).toBeUndefined();
  });

  it('drops congestion when it does not line up with the geometry', () => {
    const r = normalizeRoute({ ...fixture, legs: [{ ...fixture.legs[0], annotation: { congestion: ['low'] } }] }, 1);
    expect(r.congestion).toBeUndefined();
    expect(r.id).toBe('mapbox-1');
  });
});
