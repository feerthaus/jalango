import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Coordinates, GeoFix } from '@/types';
import { newConvoyCode } from '@/utils/convoy';

export interface Convoy {
  id: string;
  code: string;
  leader_id: string;
  name: string;
  destination_name: string | null;
  dest_latitude: number | null;
  dest_longitude: number | null;
  meet_name: string | null;
  meet_latitude: number | null;
  meet_longitude: number | null;
  expires_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface ConvoyMember {
  convoy_id: string;
  user_id: string;
  display_name: string;
  color: string;
  joined_at: string;
  left_at: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  position_at: string | null;
  eta_at: string | null;
  arrived_at: string | null;
  removed: boolean;
  /** absent until the vehicle migration is applied */
  vehicle?: 'car' | 'motorcycle';
}

export class ConvoyError extends Error {
  constructor(message: string, readonly code: 'inactive' | 'auth' | 'full' | 'network' | 'invalid') {
    super(message);
  }
}

function toConvoyError(err: { message: string; code?: string; hint?: string }): ConvoyError {
  const m = err.message ?? '';
  if (/removed from this convoy/i.test(m)) return new ConvoyError('Ketua konvoi telah mengeluarkan anda. / The leader removed you from this convoy.', 'auth');
  if (/not found or already ended|has ended|no longer in this convoy/i.test(m)) return new ConvoyError('Konvoi ini tidak wujud atau sudah tamat. / This convoy doesn’t exist or has ended.', 'inactive');
  if (/full/i.test(m)) return new ConvoyError('Konvoi penuh (maks 10 kereta). / This convoy is full (10 cars max).', 'full');
  if (/already lead/i.test(m)) return new ConvoyError('Anda sudah mengetuai 2 konvoi. Tamatkan satu dahulu. / You already lead 2 convoys.', 'invalid');
  if (/banned|suspended/i.test(m)) return new ConvoyError('Akaun anda telah digantung. / Your account is suspended.', 'auth');
  if (/only the convoy leader/i.test(m)) return new ConvoyError('Hanya ketua konvoi boleh buat ini. / Only the leader can do this.', 'auth');
  if (/sign in|JWT/i.test(m)) return new ConvoyError('Sila log masuk semula. / Please sign in again.', 'auth');
  if (/fetch|network/i.test(m)) return new ConvoyError('Tiada sambungan ke pelayan. / Can’t reach the server.', 'network');
  return new ConvoyError(m || 'Something went wrong.', 'invalid');
}

function client() {
  if (!supabase) throw new ConvoyError('Konvoi perlukan pangkalan data komuniti. / Convoy needs the community database.', 'invalid');
  return supabase;
}

export function convoyUrl(code: string): string {
  return `${window.location.origin}/convoy/${code}`;
}

export async function createConvoy(input: { name: string; displayName: string; destination?: { name: string; coordinates: Coordinates } | null }): Promise<string> {
  // Codes are random; retry on the (very unlikely) collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await client().rpc('create_convoy', {
      p_code: newConvoyCode(),
      p_name: input.name.trim().slice(0, 60) || 'Konvoi',
      p_display_name: input.displayName.trim().slice(0, 40) || 'Ketua',
      p_dest_name: input.destination?.name.slice(0, 160) ?? null,
      p_dest_lat: input.destination?.coordinates.lat ?? null,
      p_dest_lng: input.destination?.coordinates.lng ?? null,
    });
    if (!error) return data as string;
    if (error.code !== '23505') throw toConvoyError(error);
  }
  throw new ConvoyError('Could not create a convoy code. Try again.', 'invalid');
}

export async function joinConvoy(code: string, displayName: string): Promise<string> {
  const { data, error } = await client().rpc('join_convoy', { p_code: code, p_display_name: displayName.trim().slice(0, 40) || 'Ahli' });
  if (error) throw toConvoyError(error);
  return data as string;
}

export async function fetchConvoy(id: string): Promise<{ convoy: Convoy | null; members: ConvoyMember[] }> {
  const [c, m] = await Promise.all([
    client().from('convoys').select('*').eq('id', id).maybeSingle(),
    client().from('convoy_members').select('*').eq('convoy_id', id).order('joined_at'),
  ]);
  if (c.error) throw toConvoyError(c.error);
  if (m.error) throw toConvoyError(m.error);
  return { convoy: (c.data as Convoy | null) ?? null, members: (m.data ?? []) as ConvoyMember[] };
}

export async function pushConvoyPosition(convoyId: string, userId: string, fix: GeoFix, extra: { etaAt: string | null; arrived: boolean | null }) {
  const patch: Record<string, unknown> = {
    latitude: Math.round(fix.coordinates.lat * 1e6) / 1e6,
    longitude: Math.round(fix.coordinates.lng * 1e6) / 1e6,
    heading: fix.heading !== null ? Math.round(fix.heading) % 360 : null,
    speed_mps: fix.speed !== null ? Math.min(90, Math.max(0, Math.round(fix.speed * 10) / 10)) : null,
    accuracy_m: Math.min(5000, Math.round(fix.accuracy)),
    position_at: new Date(fix.timestamp).toISOString(),
    eta_at: extra.etaAt,
  };
  if (extra.arrived !== null) patch.arrived_at = extra.arrived ? new Date().toISOString() : null;
  const { error } = await client().from('convoy_members').update(patch).eq('convoy_id', convoyId).eq('user_id', userId);
  if (error) throw toConvoyError(error);
}

export async function setConvoyVehicle(convoyId: string, userId: string, vehicle: 'car' | 'motorcycle') {
  const { error } = await client().from('convoy_members').update({ vehicle }).eq('convoy_id', convoyId).eq('user_id', userId);
  if (error) throw toConvoyError(error);
}

export async function leaveConvoy(convoyId: string, userId: string): Promise<void> {
  const { error } = await client().from('convoy_members').update({ left_at: new Date().toISOString() }).eq('convoy_id', convoyId).eq('user_id', userId);
  if (error && !/no longer|ended/i.test(error.message)) throw toConvoyError(error);
}

export async function leaderUpdate(convoyId: string, field: 'destination' | 'meet' | 'end', place?: { name: string; coordinates: Coordinates } | null) {
  const { error } = await client().rpc('convoy_leader_update', {
    p_convoy: convoyId,
    p_field: field,
    p_name: place?.name ?? null,
    p_lat: place?.coordinates.lat ?? null,
    p_lng: place?.coordinates.lng ?? null,
  });
  if (error) throw toConvoyError(error);
}

export async function removeMember(convoyId: string, userId: string) {
  const { error } = await client().rpc('convoy_remove_member', { p_convoy: convoyId, p_user: userId });
  if (error) throw toConvoyError(error);
}

/** Live changes for one convoy (members only — RLS filters the stream). */
export function subscribeToConvoy(id: string, onChange: () => void, onStatus: (live: boolean) => void): () => void {
  if (!supabase) return () => {};
  const channel: RealtimeChannel = supabase
    .channel(`jalango-convoy-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'convoy_members', filter: `convoy_id=eq.${id}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'convoys', filter: `id=eq.${id}` }, onChange)
    .subscribe((status) => onStatus(status === 'SUBSCRIBED'));
  return () => {
    void supabase?.removeChannel(channel);
  };
}
