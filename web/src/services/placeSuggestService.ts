import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/types';
import { apiPost } from './apiClient';
import { adminChanged } from './adminCounts';

/** AI address finder + people's suggestions for addresses our search can't find. */

export type Precision = 'exact' | 'nearby' | 'area' | 'not_found';

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

async function userId(): Promise<string> {
  const { data } = await db().auth.getUser();
  if (!data.user) throw new Error('Please sign in again first.');
  return data.user.id;
}

function check(error: { message: string; hint?: string } | null) {
  if (!error) return;
  if (error.hint === 'rate_limited') throw new Error('rate_limited');
  throw new Error(error.message);
}

/** A point the person placed on the map themselves. */
export async function suggestPin(s: { query: string; name: string; address: string; at: Coordinates; source: 'user' | 'ai' }): Promise<void> {
  const { error } = await db()
    .from('place_suggestions')
    .insert({ user_id: await userId(), kind: 'pin', query: s.query.trim(), name: s.name.trim(), address: s.address.trim().slice(0, 200), latitude: Math.round(s.at.lat * 1e6) / 1e6, longitude: Math.round(s.at.lng * 1e6) / 1e6, source: s.source });
  check(error);
}

/** Text only: this search should show what another search finds (no map data kept). */
export async function suggestRedirect(s: { query: string; name: string; targetQuery: string }): Promise<void> {
  const { error } = await db()
    .from('place_suggestions')
    .insert({ user_id: await userId(), kind: 'redirect', query: s.query.trim(), name: s.name.trim().slice(0, 120), target_query: s.targetQuery.trim().slice(0, 200), source: 'ai' });
  check(error);
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
}

/** Admin: suggestions waiting for review, newest first. */
export async function fetchPendingSuggestions(): Promise<PlaceSuggestionRow[]> {
  const { data, error } = await db()
    .from('place_suggestions')
    .select('id, kind, query, name, address, latitude, longitude, target_query, source, created_at')
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
