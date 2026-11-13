import { describe, expect, it } from 'vitest';
import { enquiryText, estimateTotal, msisdn, overlapsBlocked, whatsappUrl } from './rentalContact';

describe('rentalContact', () => {
  it('normalises phone numbers', () => {
    expect(msisdn('+60 12-345 6789')).toBe('60123456789');
    expect(msisdn('012-3456789')).toBe('60123456789');
  });
  it('builds the car enquiry with pickup location', () => {
    const t = enquiryText({ kind: 'car_rental', title: 'Myvi 2022', url: 'https://x/sewa/1', from: '2026-12-05', to: '2026-12-07', pickup: { lat: 6.1234567, lng: 102.2 } });
    expect(t).toContain('"Myvi 2022"');
    expect(t).toContain('Ambil: 5 Dis 2026');
    expect(t).toContain('maps.google.com/?q=6.123457,102.200000');
    expect(whatsappUrl('0123456789', t)).toMatch(/^https:\/\/wa\.me\/60123456789\?text=Salam/);
  });
  it('homestay enquiry has check-in words and no location', () => {
    const t = enquiryText({ kind: 'homestay', title: 'Rumah A', url: 'u', from: '2026-12-05', to: '2026-12-06', pickup: { lat: 1, lng: 1 } });
    expect(t).toContain('Daftar masuk');
    expect(t).not.toContain('maps.google');
  });
  it('detects blocked days', () => {
    const b = new Set(['2026-12-06']);
    expect(overlapsBlocked('2026-12-05', '2026-12-06', b, 'homestay')).toBe(false); // check out that day
    expect(overlapsBlocked('2026-12-05', '2026-12-07', b, 'homestay')).toBe(true);
    expect(overlapsBlocked('2026-12-05', '2026-12-06', b, 'car_rental')).toBe(true);
  });
  it('estimates with weekend price', () => {
    // 2026-12-04 is a Friday: Fri + Sat nights are weekend
    expect(estimateTotal('2026-12-04', '2026-12-07', 100, 150, 'homestay')).toEqual({ units: 3, total: 400 });
    expect(estimateTotal('2026-12-04', '2026-12-07', 100, 150, 'car_rental')).toEqual({ units: 3, total: 400 });
  });
});
