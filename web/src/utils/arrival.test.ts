import { describe, expect, it } from 'vitest';
import { hasArrived } from './arrival';

const target = { lat: 2.9264, lng: 101.6964 };
const at = (metersNorth: number) => ({ lat: target.lat + metersNorth / 111_320, lng: target.lng });

describe('hasArrived', () => {
  it('live and within 150 m', () => {
    expect(hasArrived({ status: 'live', position: at(120), target, previousStatus: 'live' })).toBe(true);
    expect(hasArrived({ status: 'live', position: at(400), target, previousStatus: 'live' })).toBe(false);
  });
  it('sharing ended right after the trip, close to the target', () => {
    expect(hasArrived({ status: 'stopped', position: at(250), target, previousStatus: 'live' })).toBe(true);
    expect(hasArrived({ status: 'stopped', position: at(900), target, previousStatus: 'live' })).toBe(false);
  });
  it('a link that was already stopped when opened is not an arrival', () => {
    expect(hasArrived({ status: 'stopped', position: at(10), target, previousStatus: null })).toBe(false);
    expect(hasArrived({ status: 'expired', position: at(10), target, previousStatus: 'live' })).toBe(false);
  });
  it('needs a position and a target', () => {
    expect(hasArrived({ status: 'live', position: null, target, previousStatus: 'live' })).toBe(false);
    expect(hasArrived({ status: 'live', position: at(10), target: null, previousStatus: 'live' })).toBe(false);
  });
});
