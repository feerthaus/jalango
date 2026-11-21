import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/types';
import type { QuickId } from '@/utils/convoyChat';

export interface ConvoyMessage {
  id: string;
  convoy_id: string;
  user_id: string;
  quick: QuickId | null;
  body: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const COLUMNS = 'id,convoy_id,user_id,quick,body,latitude,longitude,created_at';

/** The latest messages of a convoy, oldest first (members only, enforced by the database). */
export async function fetchConvoyMessages(convoyId: string, limit = 60): Promise<ConvoyMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('convoy_messages').select(COLUMNS).eq('convoy_id', convoyId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ConvoyMessage[]).reverse();
}

export async function sendConvoyMessage(convoyId: string, body: string, quick?: QuickId | null, at?: Coordinates | null): Promise<string> {
  if (!supabase) throw new Error('Convoy chat is not connected.');
  const { data, error } = await supabase.rpc('send_convoy_message', { p_convoy: convoyId, p_body: body, p_quick: quick ?? null, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null });
  if (error) throw new Error(error.hint === 'rate_limited' ? 'rate_limited' : error.hint === 'inactive' ? 'inactive' : error.message);
  return data as string;
}

/** New messages as they arrive (realtime); the caller polls as a fallback. */
export function subscribeToConvoyMessages(convoyId: string, onMessage: (m: ConvoyMessage) => void): () => void {
  if (!supabase) return () => {};
  const channel: RealtimeChannel = supabase
    .channel(`jalango-convoy-chat-${convoyId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'convoy_messages', filter: `convoy_id=eq.${convoyId}` }, (p) => onMessage(p.new as ConvoyMessage))
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}
