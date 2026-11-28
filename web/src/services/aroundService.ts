import type { Coordinates } from '@/types';
import { apiGet } from './apiClient';

/** "Sekitar sini": JalanGo's own places around a point (community picks + POIs). No ratings exist. */
export type AroundKind = 'makan' | 'menarik';

export interface AroundPlace {
  id: string;
  name: string;
  note: string | null;
  source: 'komuniti' | 'poi';
  lat: number;
  lng: number;
  distanceMeters: number;
  recommends: number;
  confirmations: number;
  unverified: boolean;
}

/** Position sent rounded to ~100 m; not kept. */
export async function fetchAround(at: Coordinates, kind: AroundKind, signal?: AbortSignal): Promise<AroundPlace[]> {
  const { results } = await apiGet<{ results: AroundPlace[] }>('/geo/around', { kind, lat: Math.round(at.lat * 1000) / 1000, lng: Math.round(at.lng * 1000) / 1000 }, signal);
  return results ?? [];
}
