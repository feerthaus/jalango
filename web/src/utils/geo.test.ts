import { describe, expect, it } from 'vitest';
import { formatDistance, haversineMeters, isInMalaysia, toKmh } from './geo';
import { formatDuration, normalizeText } from './format';

describe('geo utils', () => {
  it('computes KL Sentral → KLCC straight-line distance (~3.5 km)', () => {
    const d = haversineMeters({ lng: 101.6865, lat: 3.134 }, { lng: 101.7116, lat: 3.1579 });
    expect(d).toBeGreaterThan(3300);
    expect(d).toBeLessThan(3900);
  });

  it('formats distances', () => {
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(437)).toBe('440 m');
    expect(formatDistance(3456)).toBe('3.5 km');
    expect(formatDistance(123_456)).toBe('123 km');
  });

  it('converts speed', () => {
    expect(toKmh(27.78)).toBe(100);
    expect(toKmh(-1)).toBe(0);
  });

  it('detects Malaysian coordinates incl. Borneo', () => {
    expect(isInMalaysia({ lat: 3.15, lng: 101.7 })).toBe(true);
    expect(isInMalaysia({ lat: 5.98, lng: 116.07 })).toBe(true);
    expect(isInMalaysia({ lat: 1.35, lng: 103.0 })).toBe(true);
    expect(isInMalaysia({ lat: 13.75, lng: 100.5 })).toBe(false);
  });
});

describe('format utils', () => {
  it('formats durations', () => {
    expect(formatDuration(20)).toBe('1 min');
    expect(formatDuration(25 * 60)).toBe('25 min');
    expect(formatDuration(2 * 3600)).toBe('2 h');
    expect(formatDuration(95 * 60)).toBe('1 h 35 min');
  });

  it('normalizes text', () => {
    expect(normalizeText('  Jalan Tun Razak,  KL ')).toBe('jalan tun razak kl');
  });
});
