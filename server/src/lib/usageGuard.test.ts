import { afterEach, describe, expect, it } from 'vitest';
import { dailyLimit } from './usageGuard.js';

describe('dailyLimit', () => {
  afterEach(() => {
    delete process.env.DAILY_LIMIT_GEO;
  });
  it('defaults to 3000 and accepts an override', () => {
    expect(dailyLimit('directions')).toBe(3000);
    process.env.DAILY_LIMIT_GEO = '12000';
    expect(dailyLimit('geo')).toBe(12000);
    process.env.DAILY_LIMIT_GEO = 'nope';
    expect(dailyLimit('geo')).toBe(3000);
  });
});
