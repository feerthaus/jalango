import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { routeFeatures } from './RouteLayer';

const route = (congestion?: Route['congestion']): Route => ({
  id: 'r',
  geometry: { type: 'LineString', coordinates: [[101.7, 3.1], [101.7, 3.11], [101.7, 3.12], [101.7, 3.13], [101.7, 3.14]] },
  distanceMeters: 4400,
  durationSeconds: 400,
  summary: '',
  hasTolls: false,
  hasMotorway: false,
  source: 'mapbox',
  steps: [],
  congestion,
});
const main = (fc: ReturnType<typeof routeFeatures>) => fc.features.filter((f) => f.properties.kind === 'main').map((f) => [f.geometry.coordinates.length - 1, f.properties.congestion, f.properties.toStop]);

describe('routeFeatures', () => {
  it('draws the way to a stop apart from the rest (violet, then blue)', () => {
    expect(main(routeFeatures([route()], 0, [], 2))).toEqual([
      [2, 'unknown', true],
      [2, 'unknown', false],
    ]);
  });
  it('keeps traffic runs and splits them at the stop', () => {
    expect(main(routeFeatures([route(['low', 'heavy', 'heavy', 'low'])], 0, [], 2))).toEqual([
      [1, 'low', true],
      [1, 'heavy', true],
      [1, 'heavy', false],
      [1, 'low', false],
    ]);
  });
  it('is one blue line without a stop (or with a stop at either end)', () => {
    expect(main(routeFeatures([route()], 0, []))).toEqual([[4, 'unknown', false]]);
    expect(main(routeFeatures([route()], 0, [], 0))).toEqual([[4, 'unknown', false]]);
    expect(main(routeFeatures([route()], 0, [], 4))).toEqual([[4, 'unknown', false]]);
  });
});
