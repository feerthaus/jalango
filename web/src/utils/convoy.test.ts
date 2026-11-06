import { describe, expect, it } from 'vitest';
import { convoyEvents, formatConvoyCode, gapsBehind, memberStatus, newAlertMemory, newConvoyCode, normalizeConvoyCode, shade, type MemberLike } from './convoy';

const T = Date.parse('2026-11-07T08:00:00Z');
const m = (id: string, lat: number | null, extra: Partial<MemberLike> = {}): MemberLike => ({
  user_id: id, display_name: id.toUpperCase(), left_at: null, latitude: lat, longitude: lat === null ? null : 101.6,
  speed_mps: 20, position_at: new Date(T - 5_000).toISOString(), arrived_at: null, ...extra,
});
const dest = { lat: 4.6, lng: 101.6 };

describe('convoy codes', () => {
  it('generates valid codes and normalizes input', () => {
    for (let i = 0; i < 50; i++) expect(normalizeConvoyCode(newConvoyCode())).not.toBeNull();
    expect(normalizeConvoyCode(' k7m4-qx2p ')).toBe('K7M4QX2P');
    expect(normalizeConvoyCode('K7M4QX2O')).toBeNull(); // O not allowed
    expect(formatConvoyCode('K7M4QX2P')).toBe('K7M4-QX2P');
  });
});

describe('memberStatus', () => {
  it('classifies members', () => {
    expect(memberStatus(m('a', 3), T)).toBe('moving');
    expect(memberStatus(m('a', 3, { speed_mps: 0 }), T)).toBe('stopped');
    expect(memberStatus(m('a', 3, { position_at: new Date(T - 4 * 60_000).toISOString() }), T)).toBe('offline');
    expect(memberStatus(m('a', null, { position_at: null }), T)).toBe('waiting');
    expect(memberStatus(m('a', 3, { arrived_at: new Date(T).toISOString() }), T)).toBe('arrived');
  });
});

describe('gapsBehind', () => {
  it('measures against the front car when there is a destination', () => {
    const g = gapsBehind([m('l', 4.0), m('a', 3.9)], 'l', dest);
    expect(g.get('l')).toBe(0);
    expect(g.get('a')!).toBeGreaterThan(10_000);
  });
  it('measures from the leader without a destination', () => {
    const g = gapsBehind([m('l', 4.0), m('a', 4.01)], 'l', null);
    expect(g.get('a')!).toBeGreaterThan(1000);
    expect(g.has('l')).toBe(false);
  });
});

describe('convoyEvents', () => {
  it('announces falling behind once, then again only after catching up', () => {
    const mem = newAlertMemory();
    const opts = { meId: 'l', leaderId: 'l', destination: dest, now: T };
    expect(convoyEvents([m('l', 4.0), m('a', 3.9)], opts, mem)).toEqual([expect.objectContaining({ kind: 'behind', userId: 'a' })]);
    expect(convoyEvents([m('l', 4.0), m('a', 3.9)], opts, mem)).toEqual([]);
    expect(convoyEvents([m('l', 4.0), m('a', 3.999)], opts, mem)).toEqual([]);
    expect(convoyEvents([m('l', 4.0), m('a', 3.9)], opts, mem)).toHaveLength(1);
  });
  it('never announces yourself', () => {
    const mem = newAlertMemory();
    expect(convoyEvents([m('l', 4.0), m('a', 3.9)], { meId: 'a', leaderId: 'l', destination: dest, now: T }, mem)).toEqual([]);
  });
  it('announces a member stopped for 3 minutes', () => {
    const mem = newAlertMemory();
    const stopped = (now: number) => [m('l', 4.0), m('a', 4.0, { speed_mps: 0, position_at: new Date(now - 5000).toISOString() })];
    const opts = (now: number) => ({ meId: 'l', leaderId: 'l', destination: null, now });
    expect(convoyEvents(stopped(T), opts(T), mem)).toEqual([]);
    expect(convoyEvents(stopped(T + 120_000), opts(T + 120_000), mem)).toEqual([]);
    expect(convoyEvents(stopped(T + 181_000), opts(T + 181_000), mem)).toEqual([{ kind: 'stopped', userId: 'a', name: 'A' }]);
    expect(convoyEvents(stopped(T + 240_000), opts(T + 240_000), mem)).toEqual([]);
  });
  it('announces when everyone has arrived', () => {
    const mem = newAlertMemory();
    const arrived = { arrived_at: new Date(T).toISOString() };
    const opts = { meId: 'l', leaderId: 'l', destination: dest, now: T };
    expect(convoyEvents([m('l', 4.6, arrived), m('a', 4.59)], opts, mem)).toEqual([]);
    expect(convoyEvents([m('l', 4.6, arrived), m('a', 4.6, arrived)], opts, mem)).toEqual([{ kind: 'all-arrived' }]);
    expect(convoyEvents([m('l', 4.6, arrived), m('a', 4.6, arrived)], opts, mem)).toEqual([]);
  });
});

describe('shade', () => {
  it('darkens and lightens', () => {
    expect(shade('#808080', -0.5)).toBe('#404040');
    expect(shade('#000000', 0.5)).toBe('#808080');
  });
});
