import { supabase } from '@/lib/supabase';
import type { Coordinates, GeoFix } from '@/types';
import { toReportError } from './reportsService';

export interface LiveShare {
  id: string;
  token: string;
  display_name: string;
  destination_name: string | null;
  expires_at: string;
  stopped_at: string | null;
  created_at: string;
}

export interface PublicLiveShare {
  status: 'live' | 'stopped' | 'expired';
  display_name: string;
  destination_name: string | null;
  dest_latitude: number | null;
  dest_longitude: number | null;
  eta_at: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  position_at: string | null;
  expires_at: string;
}

const COLUMNS = 'id,token,display_name,destination_name,expires_at,stopped_at,created_at';

function client() {
  if (!supabase) throw new Error('Live sharing needs the community database.');
  return supabase;
}

/** 128-bit random, URL-safe token (the share link is the secret). */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/live/${token}`;
}

export async function createShare(input: {
  userId: string;
  displayName: string;
  minutes: number;
  destination?: { name: string; coordinates: Coordinates } | null;
}): Promise<LiveShare> {
  const { data, error } = await client()
    .from('location_shares')
    .insert({
      token: newShareToken(),
      user_id: input.userId,
      display_name: input.displayName.trim().slice(0, 40) || 'A JalanGo driver',
      destination_name: input.destination?.name.slice(0, 160) ?? null,
      dest_latitude: input.destination?.coordinates.lat ?? null,
      dest_longitude: input.destination?.coordinates.lng ?? null,
      expires_at: new Date(Date.now() + Math.min(input.minutes, 720) * 60_000).toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as LiveShare;
}

export async function fetchMyActiveShares(): Promise<LiveShare[]> {
  const { data, error } = await client()
    .from('location_shares')
    .select(COLUMNS)
    .is('stopped_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw toReportError(error);
  return (data ?? []) as LiveShare[];
}

export async function pushPosition(ids: string[], fix: GeoFix, extra: { etaAt?: string | null; destination?: { name: string; coordinates: Coordinates } | null }) {
  if (ids.length === 0) return;
  const patch: Record<string, unknown> = {
    latitude: Math.round(fix.coordinates.lat * 1e6) / 1e6,
    longitude: Math.round(fix.coordinates.lng * 1e6) / 1e6,
    heading: fix.heading !== null ? Math.round(fix.heading) % 360 : null,
    speed_mps: fix.speed !== null ? Math.min(90, Math.max(0, Math.round(fix.speed * 10) / 10)) : null,
    accuracy_m: Math.min(5000, Math.round(fix.accuracy)),
    position_at: new Date(fix.timestamp).toISOString(),
  };
  if (extra.etaAt !== undefined) patch.eta_at = extra.etaAt;
  if (extra.destination) {
    patch.destination_name = extra.destination.name.slice(0, 160);
    patch.dest_latitude = extra.destination.coordinates.lat;
    patch.dest_longitude = extra.destination.coordinates.lng;
  }
  const { error } = await client().from('location_shares').update(patch).in('id', ids);
  if (error) throw toReportError(error);
}

export async function stopShare(id: string): Promise<void> {
  const { error } = await client().from('location_shares').update({ stopped_at: new Date().toISOString() }).eq('id', id);
  if (error && !/ended/i.test(error.message)) throw toReportError(error);
}

export async function getPublicShare(token: string): Promise<PublicLiveShare | null> {
  const { data, error } = await client().rpc('get_live_share', { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as PublicLiveShare | null;
}
