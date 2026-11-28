/**
 * "Kawasan saya": the places someone knows well (home, work, parents' house…).
 * Kept on this phone only. To ask and answer about places around them, the app
 * sends an area rounded to ~1 km; the server uses it for that answer and keeps
 * nothing (people who live or work around count, together with someone on the spot).
 */
import type { Coordinates } from '@/types';

export type AreaKind = 'rumah' | 'kerja' | 'ibu_bapa' | 'mentua' | 'lain';
export interface MyArea {
  id: string;
  kind: AreaKind;
  /** shown only on this phone (e.g. "Kampung Jenjarom") */
  label: string;
  lat: number;
  lng: number;
}

const KEY = 'jalango:my-areas';
export const MAX_AREAS = 5;
/** An answer is "local" when the place is this close to one of my areas (server rule) */
export const LOCAL_RADIUS_M = 1500;

const valid = (a: unknown): a is MyArea => {
  const x = a as MyArea;
  return Boolean(x) && typeof x.id === 'string' && ['rumah', 'kerja', 'ibu_bapa', 'mentua', 'lain'].includes(x.kind) && typeof x.label === 'string' && Number.isFinite(x.lat) && Number.isFinite(x.lng);
};

export function loadAreas(): MyArea[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    return Array.isArray(list) ? list.filter(valid).slice(0, MAX_AREAS) : [];
  } catch {
    return [];
  }
}

export function saveAreas(list: MyArea[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_AREAS)));
  } catch {
    /* private mode: kept for this visit only */
  }
}

/** ~1 km: what leaves the phone */
export const roughArea = (a: Coordinates): Coordinates => ({ lat: Math.round(a.lat * 100) / 100, lng: Math.round(a.lng * 100) / 100 });

const metres = (a: Coordinates, b: Coordinates) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

/** My area a place is in (rounded, ready to send), or null */
export function areaFor(place: Coordinates, areas: MyArea[]): Coordinates | null {
  const near = areas.map((a) => ({ a, d: metres(a, place) })).filter((x) => x.d <= LOCAL_RADIUS_M - 500).sort((x, y) => x.d - y.d)[0];
  return near ? roughArea(near.a) : null;
}
