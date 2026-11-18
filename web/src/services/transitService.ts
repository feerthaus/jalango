import type { Coordinates } from '@/types';
import { apiGet } from './apiClient';

export interface AccessLeg {
  type: 'walk' | 'ride';
  km: number;
  minutes: number;
  costMin: number;
  costMax: number;
}

export interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type TransitMode = 'ets' | 'intercity' | 'komuter' | 'shuttle' | 'lrt' | 'mrt' | 'monorail' | 'brt' | 'bus';

export interface TransitLeg {
  type: 'transit';
  mode: TransitMode;
  routeName: string;
  shortName: string;
  color: string;
  tripId: string;
  tripKey: string;
  from: Station;
  to: Station;
  depart: string;
  arrive: string;
  stops: number;
  km: number;
  fareMin: number;
  fareMax: number;
  /** fare already counted on an earlier leg (one Rapid KL fare across lines) */
  fareShared: boolean;
  /** needs a ticket bought in advance (ETS, Intercity, Shuttle Tebrau) */
  ticket: boolean;
  path: [number, number][];
}

/** Walking between two stations to change lines. */
export interface WalkLeg {
  type: 'walk';
  from: Station;
  to: Station;
  minutes: number;
  km: number;
}

export interface TransitOption {
  leave: string;
  arrive: string;
  minutes: number;
  transfers: number;
  access: AccessLeg;
  legs: (TransitLeg | WalkLeg)[];
  egress: AccessLeg;
  fareMin: number;
  fareMax: number;
  costMin: number;
  costMax: number;
  modes: TransitMode[];
}

export const rides = (o: TransitOption): TransitLeg[] => o.legs.filter((l): l is TransitLeg => l.type === 'transit');

const CACHE_MS = 3 * 60_000;
const cache = new Map<string, { at: number; value: Promise<TransitOption[]> }>();
const key = (p: Coordinates) => `${p.lng.toFixed(3)},${p.lat.toFixed(3)}`;

/**
 * Public transport from here to there, leaving now: KTMB (ETS, Intercity,
 * Komuter) and Rapid KL rail (LRT, MRT, Monorail, BRT). Fares are estimates.
 * Remembered for 3 minutes, so the route panel can ask early (prefetch) and the
 * "Awam" tab opens instantly.
 */
export function fetchTransitOptions(from: Coordinates, to: Coordinates): Promise<TransitOption[]> {
  const k = `${key(from)}|${key(to)}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = apiGet<{ options: TransitOption[] }>('/transit/plan', { from: `${from.lng.toFixed(5)},${from.lat.toFixed(5)}`, to: `${to.lng.toFixed(5)},${to.lat.toFixed(5)}` }).then((r) => r.options);
  value.catch(() => cache.delete(k)); // failures are not remembered
  cache.set(k, { at: Date.now(), value });
  return value;
}

/** Official KTMB ticketing (KITS). Phase 1: a link out; partner booking comes later. */
export const KTMB_BOOKING_URL = 'https://online.ktmb.com.my/';
