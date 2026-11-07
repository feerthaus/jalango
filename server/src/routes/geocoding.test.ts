import { describe, expect, it } from 'vitest';
import { alongQuery } from './geocoding.js';

describe('alongQuery', () => {
  it('parses route sample points', () => {
    const r = alongQuery.parse({ category: 'food', points: '101.7,3.0;102.9,1.85' });
    expect(r.points).toEqual([{ lng: 101.7, lat: 3 }, { lng: 102.9, lat: 1.85 }]);
  });
  it('rejects too many, malformed or out-of-country points and unknown categories', () => {
    expect(alongQuery.safeParse({ category: 'food', points: Array(9).fill('101.7,3.0').join(';') }).success).toBe(false);
    expect(alongQuery.safeParse({ category: 'food', points: '101.7' }).success).toBe(false);
    expect(alongQuery.safeParse({ category: 'food', points: '2.35,48.85' }).success).toBe(false);
    expect(alongQuery.safeParse({ category: 'casino', points: '101.7,3.0' }).success).toBe(false);
  });
});
