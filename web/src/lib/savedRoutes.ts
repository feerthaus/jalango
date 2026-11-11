import { useCallback, useSyncExternalStore } from 'react';
import type { Coordinates, Trip } from '@/types';
import { pathLength, roundPath, simplify, type LngLat } from '@/utils/trace';

/**
 * Routes the driver saved from their own trips ("Rumah → Kampung ikut Parit Raja"),
 * to follow again or drive back the same way. Kept on this device only.
 */
export interface SavedRoute {
  id: string;
  name: string;
  /** Driven path, start → destination */
  path: LngLat[];
  destination: { name: string; coordinates: Coordinates };
  distanceMeters: number;
  durationSeconds: number;
  createdAt: string;
}

const KEY = 'jalango:saved-routes';
const EVENT = 'jalango:saved-routes-change';
export const MAX_SAVED_ROUTES = 30;
const MAX_POINTS = 600;

let cache: SavedRoute[] | null = null;
function read(): SavedRoute[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(list) ? (list as SavedRoute[]).filter((r) => r && Array.isArray(r.path) && r.path.length >= 2) : [];
  } catch {
    cache = [];
  }
  return cache;
}
function write(list: SavedRoute[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full: keep in memory for this session */
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** A trip's trace, small enough to keep many (≤600 points). */
export function compactTrace(trace: LngLat[]): LngLat[] {
  let path = simplify(trace, 5);
  for (let tol = 10; path.length > MAX_POINTS; tol *= 1.6) path = simplify(trace, tol);
  return roundPath(path);
}

export function routeFromTrip(trip: Trip, name: string): SavedRoute | null {
  if (!trip.trace || trip.trace.length < 2) return null;
  const path = compactTrace(trip.trace);
  return {
    id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 80) || trip.destination.name,
    path,
    destination: { name: trip.destination.name, coordinates: trip.destination.coordinates },
    distanceMeters: Math.round(pathLength(path)),
    durationSeconds: Math.round(trip.durationSeconds),
    createdAt: new Date().toISOString(),
  };
}

export function useSavedRoutes() {
  const routes = useSyncExternalStore(subscribe, read, () => [] as SavedRoute[]);
  const save = useCallback((r: SavedRoute) => write([r, ...read()].slice(0, MAX_SAVED_ROUTES)), []);
  const remove = useCallback((id: string) => write(read().filter((r) => r.id !== id)), []);
  const rename = useCallback((id: string, name: string) => write(read().map((r) => (r.id === id ? { ...r, name: name.trim().slice(0, 80) || r.name } : r))), []);
  return { routes, save, remove, rename };
}
