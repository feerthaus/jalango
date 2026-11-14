import { describe, expect, it } from 'vitest';
import { formatTime, isOpenNow } from './openingHours';

// 2026-11-16 is a Monday. Times below are Malaysia time (UTC+8).
const my = (iso: string) => new Date(`${iso}+08:00`);

describe('isOpenNow', () => {
  const day = { opens: '07:00', closes: '14:00', closed_days: [5] }; // closed Friday
  it('daytime hours', () => {
    expect(isOpenNow(day, my('2026-11-16T08:00:00'))).toBe(true);
    expect(isOpenNow(day, my('2026-11-16T14:00:00'))).toBe(false);
    expect(isOpenNow(day, my('2026-11-16T06:59:00'))).toBe(false);
  });
  it('closed day', () => {
    expect(isOpenNow(day, my('2026-11-20T09:00:00'))).toBe(false); // Friday
  });
  it('night stall past midnight', () => {
    const night = { opens: '18:00', closes: '02:00', closed_days: [1] }; // closed Monday
    expect(isOpenNow(night, my('2026-11-17T23:00:00'))).toBe(true); // Tue night
    expect(isOpenNow(night, my('2026-11-18T01:30:00'))).toBe(true); // early Wed, from Tue
    expect(isOpenNow(night, my('2026-11-17T01:30:00'))).toBe(false); // early Tue, Monday was closed
    expect(isOpenNow(night, my('2026-11-16T20:00:00'))).toBe(false); // Monday
  });
  it('unknown hours', () => {
    expect(isOpenNow({}, my('2026-11-16T08:00:00'))).toBeNull();
  });
  it('formats times', () => {
    expect(formatTime('07:00')).toBe('7:00 pg');
    expect(formatTime('13:30')).toBe('1:30 tgh');
    expect(formatTime('20:00')).toBe('8:00 mlm');
  });
});
