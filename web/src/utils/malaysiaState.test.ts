import { describe, expect, it } from 'vitest';
import { stateAt } from './malaysiaState';

describe('stateAt', () => {
  it('names the state of well-known places', () => {
    expect(stateAt({ lat: 3.158, lng: 101.712 })).toBe('kl'); // KLCC
    expect(stateAt({ lat: 3.073, lng: 101.518 })).toBe('selangor'); // Shah Alam
    expect(stateAt({ lat: 2.926, lng: 101.696 })).toBe('putrajaya');
    expect(stateAt({ lat: 2.522, lng: 101.796 })).toBe('ns'); // Port Dickson
    expect(stateAt({ lat: 6.125, lng: 102.238 })).toBe('kelantan'); // Kota Bharu
    expect(stateAt({ lat: 5.329, lng: 103.137 })).toBe('terengganu');
    expect(stateAt({ lat: 1.465, lng: 103.758 })).toBe('johor'); // JB Sentral
    expect(stateAt({ lat: 5.98, lng: 116.07 })).toBe('sabah');
    expect(stateAt({ lat: 1.55, lng: 110.35 })).toBe('sarawak');
    expect(stateAt({ lat: 5.414, lng: 100.329 })).toBe('penang');
  });
  it('is null far outside Malaysia', () => {
    expect(stateAt({ lat: 13.75, lng: 100.5 })).toBeNull(); // Bangkok
  });
});
