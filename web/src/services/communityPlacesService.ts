import { supabase } from '@/lib/supabase';
import type { CommunityCategory, CommunityPlace, Place } from '@/types';
import { toReportError, type Bounds } from './reportsService';

const COLUMNS = 'id,user_id,name,category,description,address,latitude,longitude,recommend_count,created_at';

function client() {
  if (!supabase) throw new Error('Community features are not connected yet.');
  return supabase;
}

export async function fetchCommunityPlaces(bounds: Bounds, signal?: AbortSignal): Promise<CommunityPlace[]> {
  let q = client()
    .from('community_places')
    .select(COLUMNS)
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng)
    .order('recommend_count', { ascending: false })
    .limit(200);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw toReportError(error);
  return (data ?? []) as CommunityPlace[];
}

export interface NewCommunityPlace {
  name: string;
  category: CommunityCategory;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
}

export async function createCommunityPlace(p: NewCommunityPlace, userId: string): Promise<CommunityPlace> {
  const name = p.name.trim();
  if (name.length < 2 || name.length > 80) throw new Error('Name must be 2–80 characters.');
  const { data, error } = await client()
    .from('community_places')
    .insert({
      user_id: userId,
      name,
      category: p.category,
      description: p.description.trim().slice(0, 280) || null,
      address: p.address.trim().slice(0, 200) || null,
      latitude: Math.round(p.latitude * 1e6) / 1e6,
      longitude: Math.round(p.longitude * 1e6) / 1e6,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as CommunityPlace;
}

export async function setRecommendation(placeId: string, userId: string, on: boolean): Promise<void> {
  const q = on
    ? client().from('place_recommendations').insert({ place_id: placeId, user_id: userId })
    : client().from('place_recommendations').delete().eq('place_id', placeId).eq('user_id', userId);
  const { error } = await q;
  if (error && error.code !== '23505') throw toReportError(error);
}

export async function fetchMyRecommendations(ids: string[], userId: string): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await client().from('place_recommendations').select('place_id').eq('user_id', userId).in('place_id', ids.slice(0, 200));
  return new Set((data ?? []).map((r) => r.place_id as string));
}

export async function deleteCommunityPlace(id: string): Promise<void> {
  const { error } = await client().from('community_places').delete().eq('id', id);
  if (error) throw toReportError(error);
}

/** Use a community pick as a navigable Place. */
export function toPlace(c: CommunityPlace): Place {
  return {
    id: `community:${c.id}`,
    name: c.name,
    address: c.address ?? '',
    coordinates: { lat: c.latitude, lng: c.longitude },
    kind: 'poi',
    category: c.category,
    source: 'community',
  };
}
