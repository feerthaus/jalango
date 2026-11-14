import { adminChanged } from './adminCounts';
import { supabase } from '@/lib/supabase';
import type { AccidentOutcome, AccidentRecord, AccidentVehicle } from '@/types';
import { toReportError, type Bounds } from './reportsService';

const COLUMNS = 'id,user_id,latitude,longitude,occurred_on,time_of_day,vehicles,outcome,note,source,photo_path,photo_status,upvotes,downvotes,created_at';
export const PHOTO_BUCKET = 'accident-photos';

function client() {
  if (!supabase) throw new Error('Community features are not connected yet.');
  return supabase;
}

export async function fetchAccidentRecords(bounds: Bounds, signal?: AbortSignal): Promise<AccidentRecord[]> {
  let q = client()
    .from('accident_records')
    .select(COLUMNS)
    .eq('status', 'active')
    .gte('latitude', bounds.minLat)
    .lte('latitude', bounds.maxLat)
    .gte('longitude', bounds.minLng)
    .lte('longitude', bounds.maxLng)
    .order('occurred_on', { ascending: false })
    .limit(800);
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw toReportError(error);
  return (data ?? []) as AccidentRecord[];
}

/**
 * Shrink and re-encode a photo on the phone before upload: max 1280 px, JPEG.
 * Re-encoding through a canvas also drops EXIF (incl. the camera's GPS and time).
 */
export async function preparePhoto(file: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo.'))), 'image/jpeg', 0.8));
}

export async function uploadAccidentPhoto(photo: Blob, userId: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client().storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export interface NewAccidentRecord {
  latitude: number;
  longitude: number;
  occurredOn: string;
  timeOfDay: 'day' | 'night' | null;
  vehicles: AccidentVehicle[];
  outcome: AccidentOutcome;
  note: string;
  photoPath: string | null;
}

export async function createAccidentRecord(r: NewAccidentRecord, userId: string): Promise<AccidentRecord> {
  const { data, error } = await client()
    .from('accident_records')
    .insert({
      user_id: userId,
      latitude: r.latitude,
      longitude: r.longitude,
      occurred_on: r.occurredOn,
      time_of_day: r.timeOfDay,
      vehicles: r.vehicles,
      outcome: r.outcome,
      note: r.note.trim() || null,
      photo_path: r.photoPath,
    })
    .select(COLUMNS)
    .single();
  if (error) throw toReportError(error);
  return data as AccidentRecord;
}

export async function voteAccidentRecord(recordId: string, userId: string, vote: 1 | -1): Promise<void> {
  const { error } = await client().from('accident_record_votes').upsert({ record_id: recordId, user_id: userId, vote }, { onConflict: 'record_id,user_id' });
  if (error) throw toReportError(error);
}

export async function fetchMyAccidentVotes(ids: string[], userId: string): Promise<Record<string, 1 | -1>> {
  if (ids.length === 0) return {};
  const { data, error } = await client().from('accident_record_votes').select('record_id,vote').eq('user_id', userId).in('record_id', ids.slice(0, 100));
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [r.record_id as string, r.vote as 1 | -1]));
}

export async function deleteAccidentRecord(id: string): Promise<void> {
  const { error } = await client().from('accident_records').delete().eq('id', id);
  if (error) throw toReportError(error);
}

/** Short-lived links for photos the viewer may see (approved, own, or admin). Missing ones are skipped. */
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

/* ─── admin ─── */
export async function fetchPendingPhotos(): Promise<AccidentRecord[]> {
  const { data, error } = await client().from('accident_records').select(COLUMNS).eq('photo_status', 'pending').order('created_at').limit(50);
  if (error) throw toReportError(error);
  return (data ?? []) as AccidentRecord[];
}

export async function reviewAccidentPhoto(id: string, approve: boolean): Promise<void> {
  const { error } = await client().rpc('review_accident_photo', { p_record: id, p_approve: approve });
  if (error) throw toReportError(error);
  adminChanged();
}
