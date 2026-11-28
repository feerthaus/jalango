import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markAroundSeen, setAroundOff, shouldOfferAround } from './aroundPrompt';

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
});
const here = { lat: 2.8123, lng: 101.5056 };
const d1 = new Date('2026-11-28T10:00:00Z');
const d2 = new Date('2026-11-29T10:00:00Z');

describe('"Sekitar sini" prompt', () => {
  it('shows once a day per ~1 km area', () => {
    expect(shouldOfferAround(here, d1)).toBe(true);
    markAroundSeen(here, d1);
    expect(shouldOfferAround(here, d1)).toBe(false);
    expect(shouldOfferAround({ lat: 2.8141, lng: 101.5072 }, d1)).toBe(false); // same ~1 km area
    expect(shouldOfferAround({ lat: 2.9, lng: 101.5 }, d1)).toBe(true); // another area
    expect(shouldOfferAround(here, d2)).toBe(true); // next day
  });
  it('never after "Jangan tanya lagi", until turned back on', () => {
    setAroundOff(true);
    expect(shouldOfferAround(here, d2)).toBe(false);
    setAroundOff(false);
    expect(shouldOfferAround(here, d2)).toBe(true);
  });
});
