import { supabase } from '@/lib/supabase';
import { adminChanged } from './adminCounts';

/** Admin → Carian: searches that went wrong, and the fixes (synonyms, JalanGo places). */

export interface SearchMissRow {
  query_norm: string;
  sample: string;
  no_results: number;
  no_click: number;
  reports: number;
  last_note: string | null;
  hint_name: string | null;
  hint_lat: number | null;
  hint_lng: number | null;
  status: 'open' | 'fixed' | 'ignored';
  first_at: string;
  last_at: string;
}

export interface SearchSynonymRow {
  id: number;
  word: string;
  alternatives: string[];
  created_at: string;
}

export interface SearchPlaceRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  keywords: string[];
  created_at: string;
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export async function fetchSearchMisses(): Promise<SearchMissRow[]> {
  return check(await db().rpc('admin_search_misses')) ?? [];
}

export async function fetchSearchRules(): Promise<{ synonyms: SearchSynonymRow[]; places: SearchPlaceRow[] }> {
  const [syn, pl] = await Promise.all([
    db().from('search_synonyms').select('id, word, alternatives, created_at').eq('active', true).order('word'),
    db().from('search_places').select('id, name, address, latitude, longitude, keywords, created_at').eq('active', true).order('created_at', { ascending: false }),
  ]);
  return { synonyms: (check(syn) ?? []) as SearchSynonymRow[], places: (check(pl) ?? []) as SearchPlaceRow[] };
}

export async function setSearchMissStatus(query: string, status: 'open' | 'fixed' | 'ignored'): Promise<void> {
  check(await db().rpc('admin_set_search_miss', { p_query: query, p_status: status }));
  adminChanged();
}

export async function addSearchSynonym(word: string, alternatives: string[], query?: string): Promise<void> {
  check(await db().rpc('admin_add_search_synonym', { p_word: word, p_alternatives: alternatives, p_query: query ?? null }));
  adminChanged();
}

export async function addSearchPlace(p: { name: string; address: string; lat: number; lng: number; keywords: string[] }, query?: string): Promise<void> {
  check(
    await db().rpc('admin_add_search_place', {
      p_name: p.name,
      p_address: p.address,
      p_lat: p.lat,
      p_lng: p.lng,
      p_keywords: p.keywords,
      p_query: query ?? null,
    }),
  );
  adminChanged();
}

export async function retireSearchRule(kind: 'synonym' | 'place', id: string | number): Promise<void> {
  check(await db().rpc('admin_retire_search_rule', { p_kind: kind, p_id: String(id) }));
}
