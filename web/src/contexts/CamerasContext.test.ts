import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { tilesForRoute } from './CamerasContext';

describe('tilesForRoute', () => {
  it('lists each 0.5° tile the route crosses once', () => {
    const route = { geometry: { type: 'LineString', coordinates: [[101.6, 3.1], [101.7, 3.0], [102.1, 2.6], [102.9, 1.85]] } } as unknown as Route;
    expect(tilesForRoute(route)).toEqual(['203:6', '204:5', '205:3']);
  });
});
