import { describe, expect, it } from 'vitest';
import { realRate } from './growthService';

describe('realRate', () => {
  it('is a whole percent of devices old enough to judge, or null', () => {
    expect(realRate({ matured: 8, matured_real: 3 })).toBe(38);
    expect(realRate({ matured: 0, matured_real: 0 })).toBeNull();
  });
});
