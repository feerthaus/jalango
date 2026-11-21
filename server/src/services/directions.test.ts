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

  it('keeps motorway exit numbers and toll plazas / gantries in order', () => {
    const leg = fixture.legs[0];
    const r = normalizeRoute(
      {
        ...fixture,
        legs: [
          {
            ...leg,
            steps: [
              {
                ...leg.steps![0],
                exits: '111',
                intersections: [
                  { location: [101.7, 3.0], classes: ['motorway'] },
                  { location: [101.71, 3.05], classes: ['toll', 'motorway'], toll_collection: { type: 'toll_booth', name: 'Plaza Tol Sungai Besi' } },
                ],
              },
              { ...leg.steps![1], intersections: [{ location: [101.72, 3.1], toll_collection: { type: 'toll_gantry' } }] },
            ],
          },
        ],
      },
      0,
    );
    expect(r.steps[0].exits).toBe('111');
    expect(r.tollPoints).toEqual([
      { type: 'booth', name: 'Plaza Tol Sungai Besi', location: { lng: 101.71, lat: 3.05 } },
      { type: 'gantry', name: undefined, location: { lng: 101.72, lat: 3.1 } },
    ]);
    expect(r.hasTolls).toBe(true);
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

  it('walks to a station on the walking profile, without tolls, traffic or heading', () => {
    const u = buildDirectionsUrl({ lat: 3.15, lng: 101.71 }, { lat: 3.158, lng: 101.713 }, { walking: true, avoidTolls: true, heading: 90 });
    expect(u.pathname).toContain('/mapbox/walking/');
    expect(u.searchParams.get('exclude')).toBeNull();
    expect(u.searchParams.get('annotations')).toBeNull();
    expect(u.searchParams.get('bearings')).toBeNull();
    expect(u.searchParams.get('steps')).toBe('true');
  });

  it('keeps away from impassable floods with exclude=point(lng lat), alongside tolls', () => {
    const u = buildDirectionsUrl({ lng: 101.6, lat: 3.0 }, { lng: 101.7, lat: 3.1 }, { avoidTolls: true, avoidPoints: [{ lng: 101.65, lat: 3.05 }, { lng: 101.66123456, lat: 3.06 }] });
    expect(u.searchParams.get('exclude')).toBe('toll,point(101.65000 3.05000),point(101.66123 3.06000)');
    const many = Array.from({ length: 15 }, (_, i) => ({ lng: 101.6 + i * 0.001, lat: 3.0 }));
    expect(buildDirectionsUrl({ lng: 101.6, lat: 3.0 }, { lng: 101.7, lat: 3.1 }, { avoidPoints: many }).searchParams.get('exclude')!.split(',')).toHaveLength(10);
  });

  it('measures how far the route runs on toll roads (for the toll estimate)', () => {
    const r = normalizeRoute(
      {
        distance: 30_000,
        duration: 1800,
        geometry: { type: 'LineString', coordinates: [[101.6, 3.0], [101.7, 3.1]] },
        legs: [
          {
            steps: [
              { distance: 5_000, duration: 300, maneuver: { type: 'depart', location: [101.6, 3.0] }, intersections: [{ classes: [] }, { classes: [] }] },
              { distance: 20_000, duration: 900, maneuver: { type: 'turn', location: [101.62, 3.02] }, intersections: [{ classes: ['toll', 'motorway'] }, { classes: ['toll', 'motorway'] }, { classes: ['toll', 'motorway'] }, { classes: ['motorway'] }] },
              { distance: 5_000, duration: 600, maneuver: { type: 'arrive', location: [101.7, 3.1] }, intersections: [{ classes: [] }] },
            ],
          },
        ],
      },
      0,
    );
    expect(r.hasTolls).toBe(true);
    expect(r.tollMeters).toBe(15_000); // 3 of 4 samples on the 20 km step
    // a toll plaza but no toll-classed road: distance unknown, not zero
    const plazaOnly = normalizeRoute({ distance: 147_000, duration: 6000, geometry: { type: 'LineString', coordinates: [[101.6, 3.0], [102.2, 2.2]] }, legs: [{ steps: [{ distance: 147_000, duration: 6000, maneuver: { type: 'depart', location: [101.6, 3.0] }, intersections: [{ location: [101.7, 3.0], toll_collection: { type: 'toll_booth', name: 'Plaza Tol Sungai Besi' }, classes: ['motorway'] }] }] }] }, 0);
    expect(plazaOnly.hasTolls).toBe(true);
    expect(plazaOnly.tollMeters).toBeUndefined();
    expect(normalizeRoute({ distance: 1000, duration: 60, geometry: { type: 'LineString', coordinates: [[101.6, 3.0], [101.61, 3.0]] }, legs: [{ steps: [{ distance: 1000, duration: 60, maneuver: { type: 'depart', location: [101.6, 3.0] }, intersections: [{}] }] }] }, 0).tollMeters).toBeUndefined();
  });
});
