import { config } from '../config.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import type { Coordinates, Place } from '../types.js';

/**
 * POI-3: JalanGo's own POIs (OpenStreetMap data, Kuala Langat pilot) in search,
 * next to Mapbox. Off unless POI_SEARCH_ENABLED=true; never slows search down
 * (300 ms budget) and never breaks it (errors give no POIs).
 */

export type PoiCategory = 'restoran' | 'penginapan' | 'minyak' | 'bengkel' | 'runcit' | 'kesihatan' | 'tarikan' | 'ibadah';

/** Words people type for a kind of place. Longest first, so "kedai makan" wins over "kedai". */
const CATEGORY_WORDS: [string, PoiCategory, string?][] = [
  ['stesen minyak', 'minyak'],
  ['kedai makan', 'restoran'],
  ['kedai runcit', 'runcit'],
  ['pasar raya', 'runcit'],
  ['servis kereta', 'bengkel'],
  ['restoran', 'restoran'],
  ['restaurant', 'restoran'],
  ['kopitiam', 'restoran'],
  ['mamak', 'restoran'],
  ['cafe', 'restoran'],
  ['kafe', 'restoran'],
  ['makan', 'restoran'],
  ['hotel', 'penginapan'],
  ['homestay', 'penginapan'],
  ['penginapan', 'penginapan'],
  ['chalet', 'penginapan'],
  ['resort', 'penginapan'],
  ['petrol', 'minyak'],
  ['minyak', 'minyak'],
  ['bengkel', 'bengkel'],
  ['workshop', 'bengkel'],
  ['tayar', 'bengkel'],
  ['runcit', 'runcit'],
  ['supermarket', 'runcit'],
  ['klinik', 'kesihatan'],
  ['clinic', 'kesihatan'],
  ['farmasi', 'kesihatan'],
  ['pharmacy', 'kesihatan'],
  ['masjid', 'ibadah', 'masjid'],
  ['mosque', 'ibadah', 'masjid'],
  ['surau', 'ibadah', 'surau'],
  ['musolla', 'ibadah', 'surau'],
  ['muzium', 'tarikan'],
  ['pantai', 'tarikan'],
];

/** Small words left over after the category word that are not a place ("bengkel di banting", "surau dekat"). */
const FILLER = new Set(['di', 'dekat', 'berhampiran', 'near', 'in', 'kat', 'area', 'kawasan', 'sini', 'terdekat', 'nearby']);

export interface PoiQuery {
  /** name search (when the text is not "category [place]") */
  q: string | null;
  category: PoiCategory | null;
  /** word that must be in the name (masjid / surau) */
  word: string | null;
  /** settlement to filter on ("banting") */
  place: string | null;
}

/** "bengkel banting" → bengkel near Banting; "surau" → ibadah named surau…; anything else is a name search. */
export function parsePoiQuery(text: string): PoiQuery {
  const t = text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}\s'&.-]/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const [phrase, category, word] of CATEGORY_WORDS) {
    const m = t.match(new RegExp(`^(?:(.*) )?${phrase.replace(/ /g, '\\s')}(?: (.*))?$`));
    if (!m) continue;
    // only "category [place]" or "[place] category": not "restoran k2", which is a name
    const rest = [m[1], m[2]].filter(Boolean).join(' ').split(' ').filter((w) => w && !FILLER.has(w)).join(' ');
    if (rest.split(' ').filter(Boolean).length <= 2 && (!rest || /^[\p{L}\s]+$/u.test(rest))) {
      return { q: null, category, word: word ?? null, place: rest || null };
    }
    break;
  }
  return { q: t.length >= 2 ? t : null, category: null, word: null, place: null };
}

interface PoiRow {
  id: string;
  name: string;
  category: PoiCategory;
  subcategory: string | null;
  lat: number;
  lng: number;
  address: string | null;
  nearest_place: string | null;
  distance_m: number | null;
}

const CATEGORY_LABEL: Record<PoiCategory, string> = {
  restoran: 'restaurant',
  penginapan: 'hotel',
  minyak: 'fuel',
  bengkel: 'car_repair',
  runcit: 'grocery',
  kesihatan: 'clinic',
  tarikan: 'attraction',
  ibadah: 'place_of_worship',
};

export function toPlace(r: PoiRow): Place {
  return {
    id: `poi:${r.id}`,
    name: r.name,
    address: r.address ?? [r.nearest_place, 'Kuala Langat, Selangor'].filter(Boolean).join(', '),
    coordinates: { lat: r.lat, lng: r.lng },
    kind: 'poi',
    category: CATEGORY_LABEL[r.category],
    source: 'osm',
    ...(r.distance_m !== null ? { distanceMeters: r.distance_m } : {}),
  };
}

const TIMEOUT_MS = 300;

/** Live POIs for this search, or [] when switched off, not matched, slow or failing. */
export async function searchPois(text: string, near: Coordinates | undefined, limit: number): Promise<Place[]> {
  if (!config.poiSearchEnabled || !supabaseAdmin) return [];
  const pq = parsePoiQuery(text);
  if (!pq.q && !pq.category) return [];
  const call = supabaseAdmin
    .rpc('search_pois', {
      p_q: pq.q,
      p_category: pq.category,
      p_word: pq.word,
      p_place: pq.place,
      p_lat: near?.lat ?? null,
      p_lng: near?.lng ?? null,
      p_limit: Math.min(limit, 10),
    })
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return ((data as PoiRow[] | null) ?? []).map(toPlace);
    });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Place[]>((resolve) => {
    timer = setTimeout(() => resolve([]), TIMEOUT_MS);
  });
  try {
    return await Promise.race([call, timeout]);
  } catch (err) {
    console.warn('[poi_search] skipped:', err instanceof Error ? err.message : err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POIs with Mapbox: a category search ("bengkel banting") lists our POIs first (Mapbox
 * knows few of these places); a name search puts the best 2 POIs first, the rest after.
 */
export function withPois(pois: Place[], text: string): { first: Place[]; after: Place[] } {
  if (!pois.length) return { first: [], after: [] };
  const n = parsePoiQuery(text).category ? pois.length : 2;
  return { first: pois.slice(0, n), after: pois.slice(n) };
}
