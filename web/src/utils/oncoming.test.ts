import { describe, expect, it } from 'vitest';
import { cellOf, detectOncoming, neighbourCells, type DriverState } from './oncoming';

const now = 1_000_000;
// Me heading north at 22 m/s (~80 km/h) on a straight road along lng 101.70
const me: DriverState = { lat: 3.1, lng: 101.7, heading: 0, speed: 22, t: now };
const north = (m: number) => 3.1 + m / 110_574;
const others = (list: [string, Partial<DriverState>][]) =>
  new Map(list.map(([id, s]) => [id, { lat: north(300), lng: 101.7, heading: 180, speed: 22, t: now, ...s } as DriverState]));

describe('detectOncoming', () => {
  it('warns about a car coming towards us on the same road', () => {
    const t = detectOncoming(me, others([['a', {}]]), now);
    expect(t?.id).toBe('a');
    expect(t!.secondsToMeet).toBeGreaterThan(6);
    expect(t!.secondsToMeet).toBeLessThan(7.5);
  });

  it('ignores cars going the same way', () => {
    expect(detectOncoming(me, others([['a', { heading: 0 }]]), now)).toBeNull();
  });

  it('ignores the other carriageway of a divided road (too far sideways)', () => {
    expect(detectOncoming(me, others([['a', { lng: 101.7 + 40 / 111_320 }]]), now)).toBeNull();
  });

  it('ignores cars behind us, far away, stale or parked', () => {
    expect(detectOncoming(me, others([['a', { lat: north(-300) }]]), now)).toBeNull();
    expect(detectOncoming(me, others([['a', { lat: north(1500) }]]), now)).toBeNull();
    expect(detectOncoming(me, others([['a', { t: now - 10_000 }]]), now)).toBeNull();
    expect(detectOncoming(me, others([['a', { speed: 0 }]]), now)).toBeNull();
  });

  it('stays quiet in slow traffic', () => {
    expect(detectOncoming({ ...me, speed: 4 }, others([['a', {}]]), now)).toBeNull();
  });

  it('picks the most urgent car', () => {
    const t = detectOncoming(me, others([['far', { lat: north(600) }], ['near', { lat: north(200) }]]), now);
    expect(t?.id).toBe('near');
  });

  it('extrapolates a slightly old position', () => {
    // 2 s old at 22 m/s towards us → ~44 m closer than reported
    const t = detectOncoming(me, others([['a', { t: now - 2000 }]]), now);
    expect(t!.distance).toBeLessThan(270);
  });
});

describe('cells', () => {
  it('covers the 3×3 neighbourhood', () => {
    expect(neighbourCells(cellOf(3.1, 101.7))).toHaveLength(9);
  });
});
