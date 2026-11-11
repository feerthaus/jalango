import { describe, expect, it } from 'vitest';
import { laneArrowPath } from './laneArrows';

describe('laneArrowPath', () => {
  it('mirrors left turns from right ones', () => {
    expect(laneArrowPath('right')).toBe('M50 285 L50 190 Q50 135 88 135');
    expect(laneArrowPath('left')).toBe('M50 285 L50 190 Q50 135 12 135');
    expect(laneArrowPath('slight left')).toBe('M50 285 L50 195 Q50 150 20 105');
  });
  it('falls back to straight for unknown indications', () => {
    expect(laneArrowPath('merge')).toBe(laneArrowPath('straight'));
  });
});
