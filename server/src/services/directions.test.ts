import { describe, expect, it } from 'vitest';
import { buildDirectionsUrl, normalizeRoute } from './directions.js';

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

  it('keeps speed limits, lanes and ramp destinations', () => {
    const leg = fixture.legs[0];
    const r = normalizeRoute(
      {
        ...fixture,
        legs: [
          {
            ...leg,
            annotation: { ...leg.annotation, maxspeed: [{ speed: 110, unit: 'km/h' }, { unknown: true }] },
            steps: [
              {
                ...leg.steps![0],
                destinations: 'Johor Bahru, Kuala Lumpur',
                intersections: [{ lanes: [{ indications: ['left'], valid: true }, { indications: ['straight'], valid: false }] }],
              },
              leg.steps![1],
            ],
          },
        ],
      },
      0,
    );
    expect(r.maxspeeds).toEqual([110, null]);
    expect(r.steps[0].destinations).toBe('Johor Bahru, Kuala Lumpur');
    expect(r.steps[0].lanes).toEqual([{ indications: ['left'], valid: true }, { indications: ['straight'], valid: false }]);
    expect(r.steps[1].lanes).toBeUndefined();
  });
});

describe('buildDirectionsUrl', () => {
  it('sends the driver heading as the start bearing only', () => {
    const u = buildDirectionsUrl({ lng: 101.7, lat: 3.1 }, { lng: 102.9, lat: 1.85 }, { heading: 183.6, via: [{ lng: 102, lat: 2.5 }] });
    expect(u.searchParams.get('bearings')).toBe('184,45;;');
    expect(buildDirectionsUrl({ lng: 101.7, lat: 3.1 }, { lng: 102.9, lat: 1.85 }).searchParams.has('bearings')).toBe(false);
  });

  const a = { lng: 101.68, lat: 3.13 };
  const b = { lng: 101.7, lat: 3.15 };
  it('uses live traffic with alternatives for a plain A→B route', () => {
    const u = buildDirectionsUrl(a, b);
    expect(u.pathname).toContain('/driving-traffic/101.68,3.13;101.7,3.15');
    expect(u.searchParams.get('alternatives')).toBe('true');
    expect(u.searchParams.get('annotations')).toBe('congestion,maxspeed');
    expect(u.searchParams.has('waypoints')).toBe(false);
  });
  it('routes through silent via points on the plain driving profile', () => {
    const via = [{ lng: 101.69, lat: 3.14 }, { lng: 101.695, lat: 3.145 }];
    const u = buildDirectionsUrl(a, b, { via, avoidTolls: true });
    expect(u.pathname).toContain('/mapbox/driving/101.68,3.13;101.69,3.14;101.695,3.145;101.7,3.15');
    expect(u.searchParams.get('alternatives')).toBe('false');
    expect(u.searchParams.get('waypoints')).toBe('0;3');
    expect(u.searchParams.get('exclude')).toBe('toll');
    expect(u.searchParams.get('annotations')).toBe('maxspeed');
  });
});
