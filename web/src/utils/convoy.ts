import type { Coordinates } from '@/types';
import { haversineMeters } from './geo';

/** Same alphabet as the DB check: no 0/O, 1/I to avoid misreading. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newConvoyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** "k7m4-qx2p " → "K7M4QX2P" (or null when it can't be a code). */
export function normalizeConvoyCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(c) ? c : null;
}

export function formatConvoyCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export const BEHIND_M = 5_000;
export const BEHIND_RESET_M = 3_000;
export const STOPPED_MS = 3 * 60_000;
export const STALE_MS = 3 * 60_000;
export const ARRIVE_M = 150;
const STOPPED_SPEED = 1; // m/s

export interface MemberLike {
  user_id: string;
  display_name: string;
  left_at: string | null;
  latitude: number | null;
  longitude: number | null;
  speed_mps: number | null;
  position_at: string | null;
  arrived_at: string | null;
}

export type MemberStatus = 'arrived' | 'offline' | 'waiting' | 'stopped' | 'moving';

export function memberPosition(m: MemberLike): Coordinates | null {
  return m.latitude !== null && m.longitude !== null ? { lat: m.latitude, lng: m.longitude } : null;
}

export function memberStatus(m: MemberLike, now = Date.now()): MemberStatus {
  if (m.arrived_at) return 'arrived';
  if (!m.position_at || memberPosition(m) === null) return 'waiting';
  if (now - Date.parse(m.position_at) > STALE_MS) return 'offline';
  if ((m.speed_mps ?? 0) < STOPPED_SPEED) return 'stopped';
  return 'moving';
}

/**
 * How far each member trails the group: with a destination, the extra
 * straight-line distance to it compared with whoever is closest; without one,
 * the distance from the leader.
 */
export function gapsBehind(members: MemberLike[], leaderId: string, destination: Coordinates | null): Map<string, number> {
  const gaps = new Map<string, number>();
  const placed = members.filter((m) => !m.left_at && memberPosition(m) && !m.arrived_at);
  if (destination) {
    const d = placed.map((m) => [m.user_id, haversineMeters(memberPosition(m)!, destination)] as const);
    const arrivedSomeone = members.some((m) => !m.left_at && m.arrived_at);
    const front = arrivedSomeone ? 0 : Math.min(...d.map(([, x]) => x));
    for (const [id, x] of d) gaps.set(id, Math.max(0, x - front));
    return gaps;
  }
  const leader = placed.find((m) => m.user_id === leaderId);
  if (!leader) return gaps;
  for (const m of placed) if (m.user_id !== leaderId) gaps.set(m.user_id, haversineMeters(memberPosition(m)!, memberPosition(leader)!));
  return gaps;
}

export type ConvoyEvent =
  | { kind: 'behind'; userId: string; name: string; meters: number }
  | { kind: 'stopped'; userId: string; name: string }
  | { kind: 'all-arrived' };

export interface AlertMemory {
  behind: Set<string>;
  stoppedSince: Map<string, number>;
  stoppedAnnounced: Set<string>;
  allArrived: boolean;
}

export function newAlertMemory(): AlertMemory {
  return { behind: new Set(), stoppedSince: new Map(), stoppedAnnounced: new Set(), allArrived: false };
}

/** Diff the convoy against what we already announced; mutates `mem`. */
export function convoyEvents(
  members: MemberLike[],
  opts: { meId: string; leaderId: string; destination: Coordinates | null; now?: number },
  mem: AlertMemory,
): ConvoyEvent[] {
  const now = opts.now ?? Date.now();
  const active = members.filter((m) => !m.left_at);
  const events: ConvoyEvent[] = [];
  const gaps = gapsBehind(active, opts.leaderId, opts.destination);

  for (const m of active) {
    if (m.user_id === opts.meId) continue;
    const gap = gaps.get(m.user_id);
    if (gap !== undefined && gap >= BEHIND_M && !mem.behind.has(m.user_id)) {
      mem.behind.add(m.user_id);
      events.push({ kind: 'behind', userId: m.user_id, name: m.display_name, meters: gap });
    } else if ((gap === undefined || gap < BEHIND_RESET_M) && mem.behind.has(m.user_id)) {
      mem.behind.delete(m.user_id);
    }

    const status = memberStatus(m, now);
    if (status === 'stopped') {
      const since = mem.stoppedSince.get(m.user_id) ?? now;
      mem.stoppedSince.set(m.user_id, since);
      if (now - since >= STOPPED_MS && !mem.stoppedAnnounced.has(m.user_id)) {
        mem.stoppedAnnounced.add(m.user_id);
        events.push({ kind: 'stopped', userId: m.user_id, name: m.display_name });
      }
    } else if (status === 'moving' || status === 'arrived') {
      mem.stoppedSince.delete(m.user_id);
      mem.stoppedAnnounced.delete(m.user_id);
    }
  }

  const all = active.length >= 2 && active.every((m) => m.arrived_at);
  if (all && !mem.allArrived) events.push({ kind: 'all-arrived' });
  mem.allArrived = all;
  return events;
}

export function eventPhrase(e: ConvoyEvent, lang: 'ms' | 'en'): string {
  const km = e.kind === 'behind' ? Math.round(e.meters / 1000) : 0;
  if (lang === 'en') {
    if (e.kind === 'behind') return `${e.name} is about ${km} kilometres behind the convoy.`;
    if (e.kind === 'stopped') return `${e.name} has stopped for 3 minutes.`;
    return 'Everyone in the convoy has arrived.';
  }
  if (e.kind === 'behind') return `${e.name} ketinggalan lebih kurang ${km} kilometer di belakang konvoi.`;
  if (e.kind === 'stopped') return `${e.name} telah berhenti selama 3 minit.`;
  return 'Semua ahli konvoi telah tiba.';
}

/** Darken/lighten a #rrggbb colour by a factor (-1..1). */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
