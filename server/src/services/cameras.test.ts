import { describe, expect, it } from 'vitest';
import { parseMaxspeed, tileBounds, toCameras } from './cameras.js';

describe('speed cameras', () => {
  it('maps OSM nodes and speeds', () => {
    expect(toCameras([
      { type: 'node', id: 1, lat: 3.1, lon: 101.6, tags: { highway: 'speed_camera', maxspeed: '90' } },
      { type: 'node', id: 2, lat: 3.2, lon: 101.7, tags: { highway: 'speed_camera' } },
      { type: 'way', id: 3 },
    ])).toEqual([
      { id: 'osm:1', lat: 3.1, lng: 101.6, maxspeed: 90 },
      { id: 'osm:2', lat: 3.2, lng: 101.7, maxspeed: null },
    ]);
    expect(parseMaxspeed('60 mph')).toBe(97);
    expect(parseMaxspeed('signals')).toBeNull();
  });
  it('computes tile bounds', () => {
    expect(tileBounds(203, 6)).toEqual({ minLat: 3, minLng: 101.5, maxLat: 3.5, maxLng: 102 });
  });
});
