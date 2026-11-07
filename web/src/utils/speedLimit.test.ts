import { describe, expect, it } from 'vitest';
import type { Route } from '@/types';
import { isSpeeding, limitAt } from './speedLimit';

describe('speed limits', () => {
  const route = { maxspeeds: [90, null, 110] } as unknown as Route;
  it('reads the limit for the current segment', () => {
    expect(limitAt(route, 0)).toBe(90);
    expect(limitAt(route, 1)).toBeNull();
    expect(limitAt(route, 9)).toBe(110);
    expect(limitAt(null, 0)).toBeNull();
  });
  it('allows a small tolerance', () => {
    expect(isSpeeding(95, 90)).toBe(false);
    expect(isSpeeding(96, 90)).toBe(true);
    expect(isSpeeding(116, 110)).toBe(false);
    expect(isSpeeding(117, 110)).toBe(true);
    expect(isSpeeding(200, null)).toBe(false);
  });
});
