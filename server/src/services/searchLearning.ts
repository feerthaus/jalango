import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import type { Coordinates, Place } from '../types.js';
import { mergePlaces, nameHasAllTokens, searchPlaces } from './mapbox.js';

/**
 * Search that learns. Admins fix searches that went wrong (Admin → Carian)
 * with a synonym or a JalanGo place; misses are counted so they know which.
 * Only the search text and counts are stored: no user, location or IP.
 */

export interface Learned {
  synonyms: Record<string, string[]>;
  places: (Place & { keywords: string[] })[];
}

const EMPTY: Learned = { synonyms: {}, places: [] };
const TTL_MS = 5 * 60_000;
let cache: { at: number; value: Learned } | null = null;
let loading: Promise<Learned> | null = null;

/** Tests swap what the database would return. */
export function setLearned(value: Learned | null): void {
  cache = value ? { at: Date.now(), value } : null;
}

async function fetchLearned(): Promise<Learned> {
  if (!supabaseAdmin) return EMPTY;
  const [syn, pl] = await Promise.all([
    supabaseAdmin.from('search_synonyms').select('word, alternatives').eq('active', true).limit(500),
    supabaseAdmin.from('search_places').select('id, name, address, latitude, longitude, keywords').eq('active', true).limit(1000),
  ]);
  if (syn.error || pl.error) throw new Error(syn.error?.message ?? pl.error?.message);
  const synonyms: Record<string, string[]> = {};
  for (const r of syn.data ?? []) synonyms[r.word] = r.alternatives;
  const places = (pl.data ?? []).map((r) => ({
    id: `jalango:${r.id}`,
    name: r.name,
    address: r.address,
    coordinates: { lat: r.latitude, lng: r.longitude },
    kind: 'poi' as const,
    source: 'jalango' as const,
    keywords: r.keywords ?? [],
  }));
  return { synonyms, places };
}

/** Admin rules, cached 5 minutes. A database hiccup never breaks search. */
export async function loadLearned(): Promise<Learned> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  loading ??= fetchLearned()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((err) => {
      console.warn('[search_learning] rules not loaded:', err instanceof Error ? err.message : err);
      return cache?.value ?? EMPTY;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** JalanGo places whose name or keywords hold every typed word. */
export function matchLearnedPlaces(places: Learned['places'], q: string): Place[] {
  return places
    .filter((p) => nameHasAllTokens(`${p.name} ${p.keywords.join(' ')}`, q))
    .map((p): Place => ({ id: p.id, name: p.name, address: p.address, coordinates: p.coordinates, kind: p.kind, source: p.source }));
}

const distance = (a: Coordinates, b: Coordinates) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

export type MissKind = 'no_results' | 'no_click' | 'reported';

/** Count a search that didn't work. Fire and forget: never slows or breaks search. */
export async function logMiss(query: string, kind: MissKind, extra: { note?: string; hint?: { name: string; lat: number; lng: number } } = {}): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.rpc('log_search_miss', {
    p_query: query,
    p_kind: kind,
    p_note: extra.note ?? null,
    p_hint_name: extra.hint?.name ?? null,
    p_hint_lat: extra.hint?.lat ?? null,
    p_hint_lng: extra.hint?.lng ?? null,
  });
  if (error) console.warn('[search_learning] miss not logged:', error.message);
}

/** Our search plus the admin's rules: JalanGo places first, admin synonyms tried; nothing found is counted. */
export async function smartSearch(q: string, near: Coordinates | undefined, limit = 8): Promise<Place[]> {
  const learned = await loadLearned();
  const pinned = matchLearnedPlaces(learned.places, q).map((p) => (near ? { ...p, distanceMeters: Math.round(distance(near, p.coordinates)) } : p));
  const results = await searchPlaces(q, near, limit, learned.synonyms);
  const merged = mergePlaces(pinned, results, limit);
  if (merged.length === 0) void logMiss(q, 'no_results');
  return merged;
}
