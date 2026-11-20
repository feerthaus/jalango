import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/types';
import { apiPost } from './apiClient';
import { adminChanged } from './adminCounts';

/** AI address finder + people's suggestions for addresses our search can't find. */

export type Precision = 'exact' | 'area' | 'not_found';

export interface LocatedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface LocateAnswer {
  precision: Precision;
  place: LocatedPlace | null;
  area: string;
  note: string;
  landmarkQuery: string | null;
  sources: { title: string; url: string }[];
  remaining: number;
}

function db() {
  if (!supabase) throw new Error('Accounts are not available.');
  return supabase;
}

async function token(): Promise<string> {
  const { data } = await db().auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error('Please sign in again first.');
  return t;
}

export async function locateWithAi(query: string, near: Coordinates | null, lang: 'ms' | 'en'): Promise<LocateAnswer> {
  const at = near ? { lat: Math.round(near.lat * 100) / 100, lng: Math.round(near.lng * 100) / 100 } : undefined;
  return apiPost<LocateAnswer>('/assistant/locate', { query: query.trim().slice(0, 120), near: at, lang }, await token());
}

function check(error: { message: string; hint?: string } | null) {
  if (!error) return;
  if (error.hint === 'rate_limited' || error.hint === 'duplicate' || error.hint === 'too_far' || error.hint === 'voted' || error.hint === 'own') throw new Error(error.hint);
  throw new Error(error.message);
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * A point the person placed on the map themselves. Their current position (if
 * known) is sent only so the server can mark it "Ditanda di lokasi"; it is not kept.
 */
export async function suggestPin(s: { query: string; name: string; address: string; at: Coordinates; source: 'user' | 'ai'; from: Coordinates | null }): Promise<void> {
  const { error } = await db().rpc('submit_place_suggestion', {
    p_kind: 'pin',
    p_query: s.query.trim(),
    p_name: s.name.trim(),
    p_address: s.address.trim().slice(0, 200),
    p_lat: r6(s.at.lat),
    p_lng: r6(s.at.lng),
    p_target_query: null,
    p_source: s.source,
    p_from_lat: s.from ? r6(s.from.lat) : null,
    p_from_lng: s.from ? r6(s.from.lng) : null,
  });
  check(error);
}

/** Text only: this search should show what another search finds (no map data kept). */
export async function suggestRedirect(s: { query: string; name: string; targetQuery: string }): Promise<void> {
  const { error } = await db().rpc('submit_place_suggestion', {
    p_kind: 'redirect',
    p_query: s.query.trim(),
    p_name: s.name.trim().slice(0, 120),
    p_address: '',
    p_lat: null,
    p_lng: null,
    p_target_query: s.targetQuery.trim().slice(0, 200),
    p_source: 'ai',
  });
  check(error);
}

export interface NearbySuggestion {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  at_location: boolean;
  yes_count: number;
}

/** Pins near here that others suggested and still need checking (not yours, not voted). */
export async function fetchNearbySuggestions(at: Coordinates): Promise<NearbySuggestion[]> {
  const { data, error } = await db().rpc('nearby_place_suggestions', { p_lat: r6(at.lat), p_lng: r6(at.lng) });
  check(error);
  return (data ?? []) as NearbySuggestion[];
}

/** "Betul ini …?" — only counted from near the pin. Returns pending / approved / disputed. */
export async function voteSuggestion(id: string, vote: 'yes' | 'no', from: Coordinates): Promise<'pending' | 'approved' | 'disputed'> {
  const { data, error } = await db().rpc('vote_place_suggestion', { p_id: id, p_vote: vote, p_from_lat: r6(from.lat), p_from_lng: r6(from.lng) });
  check(error);
  return data as 'pending' | 'approved' | 'disputed';
}

export interface PlaceSuggestionRow {
  id: string;
  kind: 'pin' | 'redirect';
  query: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  target_query: string | null;
  source: 'user' | 'ai';
  created_at: string;
  at_location: boolean;
  yes_count: number;
  no_count: number;
  disputed: boolean;
}

/** Admin: suggestions waiting for review, newest first. */
export async function fetchPendingSuggestions(): Promise<PlaceSuggestionRow[]> {
  const { data, error } = await db()
    .from('place_suggestions')
    .select('id, kind, query, name, address, latitude, longitude, target_query, source, created_at, at_location, yes_count, no_count, disputed')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  check(error);
  return (data ?? []) as PlaceSuggestionRow[];
}

export async function reviewSuggestion(id: string, approve: boolean): Promise<void> {
  const { error } = await db().rpc('admin_review_place_suggestion', { p_id: id, p_approve: approve });
  check(error);
  adminChanged();
}
