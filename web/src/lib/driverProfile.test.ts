import { describe, expect, it } from 'vitest';
import { normalizePhone, normalizePlate } from './driverProfile';

describe('driver profile', () => {
  it('normalizes plates like the database rule', () => {
    expect(normalizePlate(' wxy  1234 ')).toBe('WXY 1234');
    expect(normalizePlate('JQA-88')).toBe('JQA88');
    expect(normalizePlate('x')).toBeNull();
    expect(normalizePlate('ABCDEFGHIJKLMN')).toBeNull();
  });
  it('normalizes Malaysian phone numbers for WhatsApp', () => {
    expect(normalizePhone('012-345 6789')).toBe('60123456789');
    expect(normalizePhone('+60 12 345 6789')).toBe('60123456789');
    expect(normalizePhone('123')).toBeNull();
  });
});
