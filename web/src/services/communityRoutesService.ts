import { supabase } from '@/lib/supabase';
import type { CommunityRoute, Coordinates } from '@/types';
import { boundsAround } from '@/utils/bounds';
import { COMMUNITY_MATCH_M } from '@/utils/communityRoutes';
import type { LngLat } from '@/utils/trace';
import { toReportError } from './reportsService';

const COLUMNS = 'id,user_id,title,via_label,note,path,start_lat,start_lng,end_lat,end_lng,distance_m,duration_s,driven_at,upvotes,downvotes,created_at';

function client() {
  if (!supabase) throw new Error('Community features are not connected yet.');
  return supabase;
}

/** Routes that start near `from` and end near `to` (precise matching happens on the phone). */
export async function fetchCommunityRoutes(from: Coordinates, to: Coordinates, signal?: AbortSignal): Promise<CommunityRoute[]> {
  const km = COMMUNITY_MATCH_M / 1000;
  const a = boundsAround(from.lat, from.lng, km);
  const b = boundsAround(to.lat, to.lng, km);
  let q = client()
    .from('community_routes')
    .select(COLUMNS)
    .gte('start_lat', a.minLat)
    .lte('start_lat', a.maxLat)
    .gte('start_lng', a.minLng)
    .lte('start_lng', a.maxLng)
    .gte('end_lat', b.minLat)
    .lte('end_lat', b.maxLat)
    .gte('end_lng', b.minLng)
    .lte('end_lng', b.maxLng)
    .order('upvotes', { ascending: false })
    .limit(30);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw toReportError(error);
  return (data ?? []) as CommunityRoute[];
}

export interface NewCommunityRoute {
  title: string;
  viaLabel: string;
  note: string;
  path: LngLat[];
  distance: number;
  durationSeconds: number;
  drivenAt: string;
}

export async function createCommunityRoute(r: NewCommunityRoute, userId: string): Promise<CommunityRoute> {
  const title = r.title.trim();
  if (title.length < 3 || title.length > 80) throw new Error('Title must be 3–80 characters.');
  const first = r.path[0];
  const last = r.path[r.path.length - 1];
  const { data, error } = await client()
    .from('community_routes')
    .insert({
      user_id: userId,
      title,
      via_label: r.viaLabel.trim() || null,
      note: r.note.trim() || null,
      path: r.path,
      start_lng: first[0],
      start_lat: first[1],
      end_lng: last[0],
      end_lat: last[1],
      distance_m: Math.round(r.distance),
      duration_s: Math.round(r.durationSeconds),
      driven_at: r.drivenAt,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as CommunityRoute;
}

export async function voteCommunityRoute(routeId: string, userId: string, vote: 1 | -1): Promise<void> {
  const { error } = await client()
    .from('community_route_votes')
    .upsert({ route_id: routeId, user_id: userId, vote }, { onConflict: 'route_id,user_id' });
  if (error) throw toReportError(error);
}

export async function fetchMyCommunityRouteVotes(ids: string[], userId: string): Promise<Record<string, 1 | -1>> {
  if (ids.length === 0) return {};
  const { data, error } = await client().from('community_route_votes').select('route_id,vote').eq('user_id', userId).in('route_id', ids.slice(0, 100));
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.route_id as string, r.vote as 1 | -1]));
}

export async function deleteCommunityRoute(id: string): Promise<void> {
  const { error } = await client().from('community_routes').delete().eq('id', id);
  if (error) throw toReportError(error);
}
