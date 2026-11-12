import { describe, expect, it } from 'vitest';
import { niceMax } from './StatsPanel';

describe('niceMax', () => {
  it('rounds the chart top to a tidy number', () => {
    expect([1, 5, 6, 12, 37, 140, 999].map(niceMax)).toEqual([5, 5, 10, 20, 50, 200, 1000]);
  });
});
