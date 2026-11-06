import { supabase } from '@/lib/supabase';
import type { Trip } from '@/types';

/**
 * Trip history. Always kept on the device (works for guests); synced to the
 * signed-in user's private `trips` table. The GPS trace never leaves the
 * device unless the user explicitly shares a shortcut from it.
 */
const KEY = 'jalango:trips';
export const MAX_TRIPS = 50;
/** Only the most recent trips keep their trace, to bound storage. */
const MAX_TRACES = 10;

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Trip[]).filter((t) => t && typeof t.id === 'string' && t.destination?.coordinates) : [];
  } catch {
    return [];
  }
}

export function storeTrips(trips: Trip[]): Trip[] {
  const trimmed = trips.slice(0, MAX_TRIPS).map((t, i) => (i < MAX_TRACES ? t : { ...t, trace: undefined }));
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // storage full: drop traces and try again
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed.map((t) => ({ ...t, trace: undefined }))));
    } catch {
      /* give up silently */
    }
  }
  return trimmed;
}

/** Insert (or update the rating of) a trip in Supabase. Returns the remote id. */
export async function syncTrip(trip: Trip, userId: string): Promise<string | undefined> {
  if (!supabase) return undefined;
  const row = {
    user_id: userId,
    destination_name: trip.destination.name.slice(0, 160),
    dest_latitude: trip.destination.coordinates.lat,
    dest_longitude: trip.destination.coordinates.lng,
    started_at: trip.startedAt,
    ended_at: trip.endedAt,
    distance_m: Math.round(trip.distanceMeters),
    duration_s: Math.round(trip.durationSeconds),
    arrived: trip.arrived,
    route_summary: trip.routeSummary?.slice(0, 200) || null,
    rating: trip.rating ?? null,
    rating_tags: trip.ratingTags ?? [],
    rating_comment: trip.ratingComment?.slice(0, 500) || null,
  };
  if (trip.remoteId) {
    const { error } = await supabase.from('trips').update(row).eq('id', trip.remoteId);
    if (error) throw new Error(error.message);
    return trip.remoteId;
  }
  const { data, error } = await supabase.from('trips').insert(row).select('id').single();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

export async function deleteRemoteTrip(remoteId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('trips').delete().eq('id', remoteId);
}
