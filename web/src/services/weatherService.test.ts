import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWeatherWarnings } from './weatherService';

afterEach(() => vi.unstubAllGlobals());

describe('fetchWeatherWarnings', () => {
  it('never returns anything but an array of well-formed warnings', async () => {
    for (const body of [{}, { warnings: null }, { warnings: 'x' }, { warnings: [null, { id: 'a' }, { id: 'b', states: ['kl'] }] }]) {
      vi.stubGlobal('fetch', async () => Response.json(body));
      const w = await fetchWeatherWarnings();
      expect(Array.isArray(w)).toBe(true);
      expect(w.every((x) => Array.isArray(x.states))).toBe(true);
    }
  });
});
