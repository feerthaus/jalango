import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { rewriteQuery } from './aiSearch.js';
import type { Coordinates, Place } from '../types.js';
import { compactName, mergePlaces, nameHasAllTokens, searchPlaces } from './mapbox.js';

/**
 * Search that learns. Admins fix searches that went wrong (Admin → Carian)
 * with a synonym, a redirect (pinned result, kept as text and looked up again:
 * Mapbox results are never stored) or a JalanGo place added by coordinates;
 * misses are counted so they know which.
 * Only the search text and counts are stored: no user, location or IP.
 */

export interface Redirect {
  keywords: string[];
  targetName: string;
  targetQuery: string;
}

export interface Learned {
  synonyms: Record<string, string[]>;
  places: (Place & { keywords: string[] })[];
  redirects: Redirect[];
}

const EMPTY: Learned = { synonyms: {}, places: [], redirects: [] };
const TTL_MS = 5 * 60_000;
let cache: { at: number; value: Learned } | null = null;
let loading: Promise<Learned> | null = null;

/** Tests swap what the database would return. */
export function setLearned(value: Learned | null): void {
  cache = value ? { at: Date.now(), value } : null;
}

async function fetchLearned(): Promise<Learned> {
  if (!supabaseAdmin) return EMPTY;
  const [syn, pl, rd] = await Promise.all([
    supabaseAdmin.from('search_synonyms').select('word, alternatives').eq('active', true).limit(500),
    supabaseAdmin.from('search_places').select('id, name, address, latitude, longitude, keywords').eq('active', true).limit(1000),
    supabaseAdmin.from('search_redirects').select('keywords, target_name, target_query').eq('active', true).limit(1000),
  ]);
  if (syn.error || pl.error || rd.error) throw new Error(syn.error?.message ?? pl.error?.message ?? rd.error?.message);
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
  const redirects = (rd.data ?? []).map((r) => ({ keywords: r.keywords ?? [], targetName: r.target_name, targetQuery: r.target_query }));
  return { synonyms, places, redirects };
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

/** The search holds every word of one of the rule's search texts ("stesen ktm gemas" ⊇ "ktm gemas"). */
export const coversKeyword = (keywords: string[], q: string) => keywords.some((k) => nameHasAllTokens(q, k));

/**
 * JalanGo places: the search holds one of the place's search texts, or the
 * typed words make up most of its name (typing just "stesen" doesn't pin it).
 */
export function matchLearnedPlaces(places: Learned['places'], q: string): Place[] {
  const typed = compactName(q).length;
  return places
    .filter((p) => coversKeyword(p.keywords, q) || (nameHasAllTokens(p.name, q) && typed >= compactName(p.name).length / 2))
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

/** A pinned result: search its saved text again and keep the place with that name. */
async function followRedirect(r: Redirect, near: Coordinates | undefined): Promise<Place | null> {
  const found = await searchPlaces(r.targetQuery, near, 5).catch(() => [] as Place[]);
  const want = compactName(r.targetName);
  return found.find((p) => compactName(p.name) === want) ?? found.find((p) => nameHasAllTokens(p.name, r.targetName)) ?? null;
}

/**
 * Our search plus the admin's rules: pinned results and JalanGo places first, admin synonyms tried; nothing found is counted.
 * With `ai`, a search that finds nothing is rewritten by a small model (typos, short forms) and searched again.
 */
export async function smartSearch(q: string, near: Coordinates | undefined, limit = 8, opts: { ai?: boolean } = {}): Promise<{ places: Place[]; rewrittenTo?: string }> {
  const learned = await loadLearned();
  const places = matchLearnedPlaces(learned.places, q).map((p) => (near ? { ...p, distanceMeters: Math.round(distance(near, p.coordinates)) } : p));
  const redirects = learned.redirects.filter((r) => coversKeyword(r.keywords, q)).slice(0, 2);
  const [results, ...followed] = await Promise.all([searchPlaces(q, near, limit, learned.synonyms), ...redirects.map((r) => followRedirect(r, near))]);
  const pinned = followed.filter((p): p is Place => p !== null).map((p) => ({ ...p, pinned: true }));
  const merged = mergePlaces([...pinned, ...places], results, limit);
  if (merged.length > 0) return { places: merged };
  if (opts.ai) {
    for (const alt of await rewriteQuery(q)) {
      const found = await searchPlaces(alt, near, limit, learned.synonyms).catch(() => [] as Place[]);
      if (found.length) {
        // still counted, with the fix as a note, so the admin can turn it into a synonym
        void logMiss(q, 'no_results', { note: `AI: ${alt}` });
        return { places: found, rewrittenTo: alt };
      }
    }
  }
  void logMiss(q, 'no_results');
  return { places: [] };
}
