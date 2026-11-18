import { describe, expect, it } from 'vitest';
import { delaySeconds, honestEta, nextSlowState, NOT_SLOW, publishedSlowSince } from './liveTraffic';

const min = 60_000;

describe('live-share traffic', () => {
  it('slow after 2 minutes under 15 km/h, not at a short red light', () => {
    let s = nextSlowState(NOT_SLOW, 5, 0);
    expect(publishedSlowSince(s, 60_000, 5000)).toBeNull();
    s = nextSlowState(s, 0, 2 * min);
    expect(publishedSlowSince(s, 2 * min, 5000)).toBe(0);
  });

  it('crawling at 18 km/h keeps it slow; 30 s above 25 km/h clears it', () => {
    let s = nextSlowState(NOT_SLOW, 5, 0);
    s = nextSlowState(s, 18, 3 * min);
    expect(s.slowSince).toBe(0);
    s = nextSlowState(s, 40, 4 * min);
    expect(s.slowSince).toBe(0); // only 0 s fast so far
    s = nextSlowState(s, 40, 4 * min + 31_000);
    expect(s).toEqual(NOT_SLOW);
  });

  it('a short burst of speed does not reset it', () => {
    let s = nextSlowState(NOT_SLOW, 5, 0);
    s = nextSlowState(s, 30, 3 * min);
    s = nextSlowState(s, 4, 3 * min + 10_000);
    expect(s).toEqual({ slowSince: 0, fastSince: null });
  });

  it('near the destination, slowing down is just arriving', () => {
    const s = nextSlowState(NOT_SLOW, 3, 0);
    expect(publishedSlowSince(s, 5 * min, 400)).toBeNull();
  });

  it('ETA is never earlier than the route says; live traffic can push it later', () => {
    expect(honestEta(0, 600, 10_000, null)).toBe(600_000);
    // live says 20 min for 10 km; 5 km left → ~10 min, route says 6 min → 10 min
    expect(honestEta(0, 360, 5_000, { at: 0, seconds: 1200, meters: 10_000 })).toBe(600_000);
    // stuck: nothing moved, live estimate keeps the full time ahead
    expect(honestEta(5 * min, 360, 10_000, { at: 0, seconds: 1200, meters: 10_000 })).toBe(5 * min + 1_200_000);
  });

  it('late by = ETA now minus ETA at the start', () => {
    expect(delaySeconds(20 * min, 10 * min)).toBe(600);
    expect(delaySeconds(5 * min, 10 * min)).toBe(0);
    expect(delaySeconds(5 * min, null)).toBe(0);
  });
});
