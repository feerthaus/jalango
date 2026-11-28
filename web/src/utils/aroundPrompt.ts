/**
 * When to offer "Sekitar sini": at most once a day per ~1 km area, never after
 * "Jangan tanya lagi". Kept on this phone only.
 */
import type { Coordinates } from '@/types';

const OFF = 'jalango:around-off';
const SEEN = 'jalango:around-seen';

const area = (at: Coordinates) => `${Math.round(at.lat * 100) / 100},${Math.round(at.lng * 100) / 100}`;
const day = (now: Date) => now.toISOString().slice(0, 10);

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function aroundOff(): boolean {
  try {
    return localStorage.getItem(OFF) === '1';
  } catch {
    return false;
  }
}

export function setAroundOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(OFF, '1');
    else localStorage.removeItem(OFF);
  } catch {
    /* ignore */
  }
}

/** Should the card show here today? */
export function shouldOfferAround(at: Coordinates, now = new Date()): boolean {
  if (aroundOff()) return false;
  return read()[area(at)] !== day(now);
}

/** The card was shown (or closed) here today */
export function markAroundSeen(at: Coordinates, now = new Date()): void {
  const today = day(now);
  // keep only today's areas
  const kept = Object.fromEntries(Object.entries(read()).filter(([, d]) => d === today));
  kept[area(at)] = today;
  try {
    localStorage.setItem(SEEN, JSON.stringify(kept));
  } catch {
    /* ignore */
  }
}
