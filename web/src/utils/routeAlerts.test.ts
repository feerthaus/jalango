import { describe, expect, it } from 'vitest';
import type { Route, TrafficReport } from '@/types';
import { justPassed, reportsOnRoute, upcomingAlerts } from './routeAlerts';
import { buildRouteIndex } from './routeProgress';

const route: Route = {
  id: 't',
  geometry: { type: 'LineString', coordinates: [[101.7, 3.1], [101.7, 3.12]] }, // ~2.2 km north
  distanceMeters: 2211,
  durationSeconds: 200,
  summary: '',
  hasTolls: false,
  hasMotorway: false,
  source: 'mapbox',
  steps: [],
};

const report = (id: string, lat: number, lng = 101.7): TrafficReport => ({
  id,
  user_id: 'u',
  report_type: 'accident',
  description: null,
  latitude: lat,
  longitude: lng,
  status: 'active',
  confirm_count: 0,
  resolve_count: 0,
  expires_at: '',
  created_at: '',
  updated_at: '',
});

describe('route alerts', () => {
  const index = buildRouteIndex(route);
  const onRoute = reportsOnRoute(index, [report('far', 3.115), report('near', 3.105), report('off', 3.11, 101.71), report('behind', 3.1015)]);

  it('keeps only reports on the route, ordered along it', () => {
    expect(onRoute.map((r) => r.report.id)).toEqual(['behind', 'near', 'far']);
  });

  it('lists reports ahead within the horizon', () => {
    const along = 0.003 * 110_574; // driver at lat 3.103
    const ahead = upcomingAlerts(onRoute, along, 1000);
    expect(ahead.map((a) => a.report.id)).toEqual(['near']);
    expect(ahead[0].distance).toBeGreaterThan(200);
    expect(ahead[0].distance).toBeLessThan(250);
  });

  it('finds reports just passed', () => {
    const along = 0.003 * 110_574;
    expect(justPassed(onRoute, along).map((r) => r.report.id)).toEqual(['behind']);
  });
});
