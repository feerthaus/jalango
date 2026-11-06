import { supabase } from '@/lib/supabase';
import type { Shortcut } from '@/types';
import { pathLength, roundPath, simplify, trimEnds, type LngLat } from '@/utils/trace';
import { toReportError, type Bounds } from './reportsService';

const COLUMNS = 'id,user_id,title,description,avoids,path,start_lat,start_lng,end_lat,end_lng,distance_m,upvotes,downvotes,created_at';
export const SHORTCUT_PRIVACY_TRIM_M = 300;
export const SHORTCUT_MIN_M = 500;
export const SHORTCUT_MAX_M = 60_000;

function client() {
  if (!supabase) throw new Error('Community features are not connected yet.');
  return supabase;
}

export async function fetchShortcuts(bounds: Bounds, signal?: AbortSignal): Promise<Shortcut[]> {
  let q = client()
    .from('shortcuts')
    .select(COLUMNS)
    .gte('start_lat', bounds.minLat)
    .lte('start_lat', bounds.maxLat)
    .gte('start_lng', bounds.minLng)
    .lte('start_lng', bounds.maxLng)
    .order('upvotes', { ascending: false })
    .limit(100);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw toReportError(error);
  return (data ?? []) as Shortcut[];
}

/**
 * Turn a driven trace into a shareable shortcut path: trim both ends for
 * privacy, simplify, round. Returns null when too short/long.
 */
export function preparePath(trace: LngLat[]): { path: LngLat[]; distance: number } | null {
  const trimmed = trimEnds(trace, SHORTCUT_PRIVACY_TRIM_M);
  if (trimmed.length < 2) return null;
  let path = simplify(trimmed, 10);
  for (let tol = 20; path.length > 400; tol *= 1.6) path = simplify(trimmed, tol);
  path = roundPath(path);
  const distance = pathLength(path);
  if (distance < SHORTCUT_MIN_M || distance > SHORTCUT_MAX_M) return null;
  return { path, distance };
}

export interface NewShortcut {
  title: string;
  description: string;
  avoids: string;
  path: LngLat[];
  distance: number;
}

export async function createShortcut(s: NewShortcut, userId: string): Promise<Shortcut> {
  const title = s.title.trim();
  if (title.length < 3 || title.length > 80) throw new Error('Title must be 3–80 characters.');
  const first = s.path[0];
  const last = s.path[s.path.length - 1];
  const { data, error } = await client()
    .from('shortcuts')
    .insert({
      user_id: userId,
      title,
      description: s.description.trim() || null,
      avoids: s.avoids.trim() || null,
      path: s.path,
      start_lng: first[0],
      start_lat: first[1],
      end_lng: last[0],
      end_lat: last[1],
      distance_m: Math.round(s.distance),
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as Shortcut;
}

export async function voteShortcut(shortcutId: string, userId: string, vote: 1 | -1): Promise<void> {
  const { error } = await client()
    .from('shortcut_votes')
    .upsert({ shortcut_id: shortcutId, user_id: userId, vote }, { onConflict: 'shortcut_id,user_id' });
  if (error) throw toReportError(error);
}

export async function fetchMyShortcutVotes(ids: string[], userId: string): Promise<Record<string, 1 | -1>> {
  if (ids.length === 0) return {};
  const { data, error } = await client().from('shortcut_votes').select('shortcut_id,vote').eq('user_id', userId).in('shortcut_id', ids.slice(0, 100));
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.shortcut_id as string, r.vote as 1 | -1]));
}

export async function deleteShortcut(id: string): Promise<void> {
  const { error } = await client().from('shortcuts').delete().eq('id', id);
  if (error) throw toReportError(error);
}
