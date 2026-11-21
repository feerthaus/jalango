import { describe, expect, it } from 'vitest';
import type { RouteStep } from '@/types';
import { cameraZoom, isRealTurn } from './turnFocus';

const s = (type: string, modifier?: string, motorway?: boolean) =>
  ({ instruction: '', distanceMeters: 0, durationSeconds: 0, maneuver: { type, modifier, location: { lat: 0, lng: 0 } }, motorway }) as RouteStep;

describe('isRealTurn', () => {
  it('is true for turns and roundabouts, not for straight, start or end', () => {
    expect(isRealTurn(s('turn', 'left'))).toBe(true);
    expect(isRealTurn(s('roundabout'))).toBe(true);
    expect(isRealTurn(s('new name', 'straight'))).toBe(false);
    expect(isRealTurn(s('arrive', 'left'))).toBe(false);
    expect(isRealTurn(undefined)).toBe(false);
  });
});

describe('cameraZoom', () => {
  it('closes in just before a town turn', () => {
    expect(cameraZoom(8, s('turn', 'left'), 120)).toBe(17.5);
    expect(cameraZoom(8, s('turn', 'left'), 400)).toBe(16.5);
  });
  it('keeps the normal view on highways, at speed and when going straight', () => {
    expect(cameraZoom(25, s('turn', 'left'), 100)).toBe(15.5);
    expect(cameraZoom(10, s('off ramp', 'slight left', true), 100)).toBe(16.5);
    expect(cameraZoom(8, s('new name', 'straight'), 50)).toBe(16.5);
    expect(cameraZoom(null, undefined, null)).toBe(16.5);
  });
});
