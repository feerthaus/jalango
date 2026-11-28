import { describe, expect, it } from 'vitest';
import type { TFn } from '@/lib/i18n';
import { distText, fare, rm, waitText } from './transitText';

const ms = ((a: string | { ms: string }) => (typeof a === 'string' ? a : a.ms)) as TFn;

describe('transit text', () => {
  it('writes fares the same way everywhere (audit: "~RM56–58.9")', () => {
    expect(rm(18.3)).toBe('RM18.30');
    expect(fare(56, 58.9)).toBe('RM56–RM58.90');
    expect(fare(4, 4)).toBe('RM4');
  });
  it('says how long in hours, not "417 min lagi"', () => {
    expect(waitText(417, ms)).toBe('6 j 57 min');
    expect(waitText(120, ms)).toBe('2 j');
    expect(waitText(12.4, ms)).toBe('12 min');
    expect(waitText(-3, ms)).toBe('0 min');
  });
  it('never says "0 km"', () => {
    expect(distText(0)).toBe('10 m');
    expect(distText(0.35)).toBe('350 m');
    expect(distText(1)).toBe('1 km');
    expect(distText(2.46)).toBe('2.5 km');
  });
});
