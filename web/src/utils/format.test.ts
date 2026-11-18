import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './format';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  const ago = (s: number) => new Date(now - s * 1000).toISOString();

  it('speaks Malay in Malay', () => {
    expect(formatRelativeTime(ago(10), 'ms', now)).toBe('baru tadi');
    expect(formatRelativeTime(ago(300), 'ms', now)).toBe('5 min lalu');
    expect(formatRelativeTime(ago(22 * 3600), 'ms', now)).toBe('22 jam lalu');
  });

  it('speaks English in English', () => {
    expect(formatRelativeTime(ago(10), 'en', now)).toBe('just now');
    expect(formatRelativeTime(ago(300), 'en', now)).toBe('5 min ago');
    expect(formatRelativeTime(ago(22 * 3600), 'en', now)).toBe('22 h ago');
  });

  it('shows a date after a day', () => {
    expect(formatRelativeTime(ago(3 * 86_400), 'ms', now)).toMatch(/15/);
    expect(formatRelativeTime(ago(3 * 86_400), 'en', now)).toMatch(/15 Nov/);
  });
});
