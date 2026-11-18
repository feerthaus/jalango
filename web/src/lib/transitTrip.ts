import { useSyncExternalStore } from 'react';
import type { TransitOption } from '@/services/transitService';
import type { Coordinates } from '@/types';
import { startProgress, type TripProgress } from '@/utils/transitProgress';

/**
 * The public transport trip being followed ("Mula" on an Awam option).
 * Kept on this phone only (localStorage), so it survives a reload or the
 * browser being closed in the train. Nothing is sent anywhere.
 */
export interface TransitTrip {
  option: TransitOption;
  from: Coordinates;
  to: Coordinates;
  destinationName: string;
  startedAt: number;
  progress: TripProgress;
}

const KEY = 'jalango:transit-trip';
const MAX_AGE_MS = 12 * 3600_000;

function load(): TransitTrip | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const trip = JSON.parse(raw) as TransitTrip;
    // an old trip (well past its arrival) is over
    if (!trip?.option?.legs || Date.now() - Date.parse(trip.option.arrive) > 3 * 3600_000 || Date.now() - trip.startedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return trip;
  } catch {
    return null;
  }
}

let current: TransitTrip | null | undefined;
const listeners = new Set<() => void>();

function get(): TransitTrip | null {
  if (current === undefined) current = typeof localStorage === 'undefined' ? null : load();
  return current;
}

function set(next: TransitTrip | null): void {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the trip still works until reload */
  }
  listeners.forEach((l) => l());
}

export function startTransitTrip(t: Omit<TransitTrip, 'startedAt' | 'progress'>): void {
  set({ ...t, startedAt: Date.now(), progress: startProgress() });
}

export function updateTransitProgress(progress: TripProgress): void {
  const trip = get();
  if (!trip) return;
  if (JSON.stringify(trip.progress) === JSON.stringify(progress)) return;
  set({ ...trip, progress });
}

export function endTransitTrip(): void {
  set(null);
}

export function useTransitTrip(): TransitTrip | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => null,
  );
}
