import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/types';

/**
 * POI-3b: community checks on JalanGo POIs (OpenStreetMap places, ids "poi:…").
 * Only the account and the answer are kept. Your position, if known, is sent only
 * so the database can tell whether you were within 300 m; it is not stored.
 */

export type PoiFeedbackKind = 'masih_beroperasi' | 'sudah_tutup' | 'lokasi_salah' | 'nama_dicadangkan';
export type PoiVerification = 'belum' | 'perlu_pengesahan' | 'disahkan_komuniti' | 'dilapor_tutup';

export interface MyPoiFeedback {
  answered: PoiFeedbackKind[];
  verification: PoiVerification | null;
  /** people (on the spot or living / working around) who said it is still open */
  confirmations: number;
}

/** The database id of a JalanGo POI place, or null for other places. */
export const poiIdOf = (placeId: string): string | null => {
  const m = /^poi:([0-9a-f-]{36})$/i.exec(placeId);
  return m ? m[1] : null;
};

function db() {
  if (!supabase) throw new Error('Accounts are not available.');
  return supabase;
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export async function myPoiFeedback(poiId: string): Promise<MyPoiFeedback> {
  const { data, error } = await db().rpc('poi_feedback_mine', { p_poi: poiId });
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Partial<MyPoiFeedback>;
  return { answered: d.answered ?? [], verification: d.verification ?? null, confirmations: d.confirmations ?? 0 };
}

/**
 * false when this answer was already given (or the place is no longer live).
 * `area`: one of my areas, already rounded to ~1 km (utils/myAreas), when the place is in it.
 */
export async function sendPoiFeedback(poiId: string, kind: PoiFeedbackKind, from: Coordinates | null, suggestedName?: string, area?: Coordinates | null): Promise<boolean> {
  const { data, error } = await db().rpc('poi_submit_feedback_v2', {
    p_poi: poiId,
    p_kind: kind,
    p_lat: from ? r5(from.lat) : null,
    p_lng: from ? r5(from.lng) : null,
    p_area_lat: area?.lat ?? null,
    p_area_lng: area?.lng ?? null,
    p_suggested_name: suggestedName?.replace(/\s+/g, ' ').trim().slice(0, 160) || null,
    p_suggested_category: null,
  });
  if (error) throw new Error(error.hint === 'rate_limited' ? 'rate_limited' : error.message);
  return data === true;
}

export interface NearbyPoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  distance_m: number;
}

/**
 * Unconfirmed POIs I have not answered: within 500 m of where I am (on the spot), or
 * within 1.5 km of one of my areas (pass the rounded area and 1500). Not kept.
 */
export async function fetchNearbyUnverified(at: Coordinates, radius = 500): Promise<NearbyPoi[]> {
  const { data, error } = await db().rpc('unverified_pois_around', { p_lat: r5(at.lat), p_lng: r5(at.lng), p_radius: radius });
  if (error) throw new Error(error.message);
  return (data as NearbyPoi[] | null) ?? [];
}

// ── Review queue answered by people nearby (POI, owner option A) ──────────

export type QueueQuestion = 'nama' | 'kategori' | 'awam';
export type QueueAnswer = 'nama' | 'kategori_ya' | 'kategori_tidak' | 'awam_ya' | 'awam_tidak' | 'tiada';

export interface NearbyQueueRecord {
  id: string;
  question: QueueQuestion;
  name: string | null;
  category: string;
  subcategory: string | null;
  lat: number;
  lng: number;
  distance_m: number;
}

/** Records waiting for review I have not answered, around where I am (500 m) or one of my areas (1500 m). Not kept. */
export async function fetchNearbyQueue(at: Coordinates, radius = 500): Promise<NearbyQueueRecord[]> {
  const { data, error } = await db().rpc('queue_records_around', { p_lat: r5(at.lat), p_lng: r5(at.lng), p_radius: radius });
  if (error) throw new Error(error.message);
  return (data as NearbyQueueRecord[] | null) ?? [];
}

/** 'approved' / 'rejected' when this answer settled it, 'open' when it waits for more, 'closed' / 'answered' otherwise. */
export async function answerQueue(id: string, answer: QueueAnswer, from: Coordinates | null, name?: string, area?: Coordinates | null): Promise<string> {
  const { data, error } = await db().rpc('answer_queue_record', {
    p_id: id,
    p_answer: answer,
    p_name: name?.replace(/\s+/g, ' ').trim().slice(0, 120) || null,
    p_lat: from ? r5(from.lat) : null,
    p_lng: from ? r5(from.lng) : null,
    p_area_lat: area?.lat ?? null,
    p_area_lng: area?.lng ?? null,
  });
  if (error) throw new Error(error.hint === 'rate_limited' ? 'rate_limited' : error.hint === 'nama_generik' ? 'nama_generik' : error.message);
  return String(data ?? 'open');
}
