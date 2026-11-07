import { describe, expect, it } from 'vitest';
import { pickLatest } from './fuel.js';

describe('pickLatest', () => {
  it('takes the newest price level and its weekly change', () => {
    const r = pickLatest([
      { date: '2026-10-30', series_type: 'level', ron95: 1.99, ron97: 3.2, diesel: 2.9 },
      { date: '2026-11-06', series_type: 'change_weekly', ron95: 0, ron97: -0.05, diesel: 0.02 },
      { date: '2026-11-06', series_type: 'level', ron95: 1.99, ron97: 3.15, diesel: 2.92, note: 'x' },
    ]);
    expect(r).toEqual({ date: '2026-11-06', prices: { ron95: 1.99, ron97: 3.15, diesel: 2.92 }, change: { ron95: 0, ron97: -0.05, diesel: 0.02 }, source: 'data.gov.my (fuelprice)' });
  });
  it('returns null for empty data', () => {
    expect(pickLatest([])).toBeNull();
  });
});
