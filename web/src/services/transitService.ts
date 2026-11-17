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

export interface TrainLeg {
  type: 'train';
  kind: 'ets' | 'intercity' | 'komuter' | 'shuttle';
  routeId: string;
  routeName: string;
  color: string;
  tripId: string;
  from: Station;
  to: Station;
  depart: string;
  arrive: string;
  km: number;
  stops: number;
  fareMin: number;
  fareMax: number;
  ticket: boolean;
  path: [number, number][];
}

export interface TrainOption {
  leave: string;
  arrive: string;
  minutes: number;
  transfers: number;
  access: AccessLeg;
  legs: TrainLeg[];
  egress: AccessLeg;
  fareMin: number;
  fareMax: number;
  costMin: number;
  costMax: number;
}

const CACHE_MS = 3 * 60_000;
const cache = new Map<string, { at: number; value: Promise<TrainOption[]> }>();
const key = (p: Coordinates) => `${p.lng.toFixed(3)},${p.lat.toFixed(3)}`;

/**
 * KTMB trains (ETS, Intercity, Komuter) from here to there, leaving now. Fares
 * are estimates. Remembered for 3 minutes, so the route panel can ask early
 * (prefetch) and the "Tren" tab opens instantly.
 */
export function fetchTrainOptions(from: Coordinates, to: Coordinates): Promise<TrainOption[]> {
  const k = `${key(from)}|${key(to)}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = apiGet<{ options: TrainOption[] }>('/transit/train', { from: `${from.lng.toFixed(5)},${from.lat.toFixed(5)}`, to: `${to.lng.toFixed(5)},${to.lat.toFixed(5)}` }).then((r) => r.options);
  value.catch(() => cache.delete(k)); // failures are not remembered
  cache.set(k, { at: Date.now(), value });
  return value;
}

/** Official KTMB ticketing (KITS). Phase 1: a link out; partner booking comes later. */
export const KTMB_BOOKING_URL = 'https://online.ktmb.com.my/';
