import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import type { Coordinates } from '../types.js';

/**
 * "Sekitar sini": places to eat / things to see around a point, from JalanGo's own
 * data only: community picks (with how many recommend them) and JalanGo POIs (with
 * how many people confirmed them). There are no reviews or ratings, and none are
 * made up. Free: no Mapbox or AI call.
 */

export type AroundKind = 'makan' | 'menarik';

export interface AroundPlace {
  /** "community:<id>" or "poi:<id>", as the app's place ids */
  id: string;
  name: string;
  /** community description, or the POI's subcategory */
  note: string | null;
  source: 'komuniti' | 'poi';
  lat: number;
  lng: number;
  distanceMeters: number;
  /** people who recommend it (community picks) */
  recommends: number;
  /** people who confirmed it is still there (POIs) */
  confirmations: number;
  /** a JalanGo POI nobody has confirmed yet */
  unverified: boolean;
}

interface Row {
  id: string;
  source: 'komuniti' | 'poi';
  name: string;
  note: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  recommends: number;
  confirmations: number;
  verification: string | null;
}

export const toAround = (r: Row): AroundPlace => ({
  id: `${r.source === 'komuniti' ? 'community' : 'poi'}:${r.id}`,
  name: r.name,
  note: r.note,
  source: r.source,
  lat: r.lat,
  lng: r.lng,
  distanceMeters: r.distance_m,
  recommends: r.recommends,
  confirmations: Number(r.confirmations),
  unverified: r.source === 'poi' && r.verification !== 'disahkan_komuniti',
});

export async function placesAround(near: Coordinates, kind: AroundKind, radius = 3000, limit = 10): Promise<AroundPlace[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin.rpc('places_around', { p_lat: near.lat, p_lng: near.lng, p_kind: kind, p_radius: radius, p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data as Row[] | null) ?? []).map(toAround);
}
