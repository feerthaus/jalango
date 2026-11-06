import { describe, expect, it } from 'vitest';
import { angleDelta, lerpAngle, stepDuration } from './motion';

describe('motion', () => {
  it('takes the shortest way round', () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0);
    expect(lerpAngle(90, 180, 0.5)).toBeCloseTo(135);
  });
  it('matches the GPS interval within bounds', () => {
    expect(stepDuration(null, 1000)).toBe(0);
    expect(stepDuration(1000, 2000)).toBe(1000);
    expect(stepDuration(1000, 1010)).toBe(250);
    expect(stepDuration(1000, 9000)).toBe(1500);
  });
});
