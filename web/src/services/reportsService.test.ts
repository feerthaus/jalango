import { describe, expect, it } from 'vitest';
import type { TrafficReport } from '@/types';
import { isVisible, toReportError, validateNewReport } from './reportsService';

const base: TrafficReport = {
  id: 'r1',
  user_id: 'u1',
  report_type: 'flood',
  description: null,
  latitude: 3.1,
  longitude: 101.6,
  status: 'active',
  confirm_count: 0,
  resolve_count: 0,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('reportsService helpers', () => {
  it('maps database errors to friendly codes', () => {
    expect(toReportError({ message: 'Too many reports.', hint: 'rate_limited' }).code).toBe('rate_limited');
    expect(toReportError({ message: 'dup', hint: 'duplicate' }).code).toBe('duplicate');
    expect(toReportError({ message: 'x', code: '23505' }).code).toBe('duplicate');
    expect(toReportError({ message: 'x', code: '23514' }).code).toBe('invalid');
    expect(toReportError({ message: 'new row violates row-level security policy' }).code).toBe('auth');
    expect(toReportError({ message: 'TypeError: Failed to fetch' }).code).toBe('network');
  });

  it('validates new reports', () => {
    expect(validateNewReport({ type: 'flood', description: 'ok', coordinates: { lat: 3, lng: 101 } })).toBeNull();
    expect(validateNewReport({ type: 'flood', description: 'x'.repeat(281), coordinates: { lat: 3, lng: 101 } })).toMatch(/280/);
    expect(validateNewReport({ type: 'flood', description: '', coordinates: { lat: NaN, lng: 101 } })).toMatch(/location/);
  });

  it('hides resolved and expired reports', () => {
    expect(isVisible(base)).toBe(true);
    expect(isVisible({ ...base, status: 'resolved' })).toBe(false);
    expect(isVisible({ ...base, expires_at: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
});
