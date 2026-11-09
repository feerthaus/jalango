import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from './errors.js';
import { dailyLimit, emergencyLimit, guardUsage, setUsageCounter, withUsagePolicy, type UsageCounter } from './usageGuard.js';

afterEach(() => {
  setUsageCounter(null);
  delete process.env.DAILY_LIMIT_GEO;
  delete process.env.EMERGENCY_LIMIT_PER_HOUR;
  vi.restoreAllMocks();
});

describe('limits', () => {
  it('defaults and env overrides', () => {
    expect(dailyLimit('directions')).toBe(3000);
    process.env.DAILY_LIMIT_GEO = '12000';
    expect(dailyLimit('geo')).toBe(12000);
    process.env.DAILY_LIMIT_GEO = 'nope';
    expect(dailyLimit('geo')).toBe(3000);
    expect(emergencyLimit('directions')).toBe(200);
  });
});

describe('guardUsage', () => {
  it('allows everything when no shared counter is configured (local development)', async () => {
    setUsageCounter(null);
    await expect(guardUsage('geo', 50)).resolves.toBeUndefined();
  });

  it('counts each call and refuses once the daily ceiling is passed', async () => {
    let total = 2999;
    const counter: UsageCounter = vi.fn(async (_k, n) => (total += n));
    setUsageCounter(counter);
    await expect(guardUsage('geo')).resolves.toBeUndefined(); // 3000
    const err = await guardUsage('geo').catch((e) => e); // 3001
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 503, code: 'daily_quota' });
    expect(counter).toHaveBeenCalledTimes(2);
  });

  describe('when the shared counter is down', () => {
    const down: UsageCounter = async () => {
      throw new Error('supabase unreachable');
    };

    it('optional features fail closed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setUsageCounter(down);
      const err = await withUsagePolicy('optional', () => guardUsage('geo')).catch((e) => e);
      expect(err).toMatchObject({ status: 503, code: 'usage_counter_unavailable' });
    });

    it('critical features continue on a per-instance emergency budget, then stop', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.EMERGENCY_LIMIT_PER_HOUR = '3';
      setUsageCounter(down);
      await guardUsage('directions');
      await guardUsage('directions');
      await guardUsage('directions');
      const err = await guardUsage('directions').catch((e) => e);
      expect(err).toMatchObject({ status: 503, code: 'usage_counter_unavailable' });
    });

    it('logs the failure (not silently swallowed)', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      setUsageCounter(down);
      await guardUsage('directions').catch(() => {});
      expect(log).toHaveBeenCalled();
    });
  });
});
