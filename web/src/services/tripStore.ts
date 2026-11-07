import type { Coordinates, Place } from '@/types';

/**
 * Remembers the current trip on this device so a closed or killed app can
 * pick it up again. Only the destination and options are stored — the route
 * itself is recalculated from wherever the driver is when the app reopens.
 */
export interface SavedTrip {
  destination: Place;
  avoidTolls: boolean;
  /** true = was in turn-by-turn mode, false = was choosing a route */
  navigating: boolean;
  /** route was going through a community shortcut */
  via?: Coordinates[];
  shortcutTitle?: string;
  /** a stop (e.g. a restaurant) on the way to the destination */
  stop?: Place;
  savedAt: number;
}

const KEY = 'jalango:active-trip';
/** Older trips are considered finished/abandoned. */
export const TRIP_MAX_AGE_MS = 8 * 3600_000;

export function loadTrip(now = Date.now()): SavedTrip | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as SavedTrip;
    const ok =
      t &&
      typeof t.savedAt === 'number' &&
      now - t.savedAt < TRIP_MAX_AGE_MS &&
      typeof t.destination?.name === 'string' &&
      typeof t.destination?.coordinates?.lat === 'number' &&
      typeof t.destination?.coordinates?.lng === 'number';
    if (!ok) {
      localStorage.removeItem(KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function saveTrip(trip: Omit<SavedTrip, 'savedAt'>): void {
  try {
    const { distanceMeters: _d, ...destination } = trip.destination;
    localStorage.setItem(KEY, JSON.stringify({ ...trip, destination, savedAt: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearTrip(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ─── Trace of the trip in progress (survives the app being closed) ─── */

const TRACE_KEY = 'jalango:active-trace';

export interface ActiveTrace {
  startedAt: string;
  trace: [number, number][];
}

export function saveActiveTrace(t: ActiveTrace): void {
  try {
    localStorage.setItem(TRACE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

export function loadActiveTrace(): ActiveTrace | null {
  try {
    const t = JSON.parse(localStorage.getItem(TRACE_KEY) ?? 'null') as ActiveTrace | null;
    return t && typeof t.startedAt === 'string' && Array.isArray(t.trace) ? t : null;
  } catch {
    return null;
  }
}

export function clearActiveTrace(): void {
  try {
    localStorage.removeItem(TRACE_KEY);
  } catch {
    /* ignore */
  }
}
