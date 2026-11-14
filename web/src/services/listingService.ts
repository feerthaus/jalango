import { adminChanged } from './adminCounts';
import { supabase } from '@/lib/supabase';
import { preparePhoto } from './accidentService';
import type { OperatorKind } from './operatorService';
import { toReportError } from './reportsService';

export type ListingStatus = 'draft' | 'pending' | 'live' | 'rejected' | 'paused';
export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface CarDetails {
  brand?: string;
  model?: string;
  year?: number;
  transmission?: 'auto' | 'manual';
  seats?: number;
  fuel?: 'petrol' | 'diesel' | 'hybrid' | 'ev';
}
export interface HomestayDetails {
  type?: 'house' | 'room' | 'apartment' | 'chalet';
  bedrooms?: number;
  bathrooms?: number;
  max_guests?: number;
  amenities?: string[];
  check_in?: string;
  check_out?: string;
  rules?: string;
}

export interface ListingPhoto {
  id: string;
  listing_id: string;
  path: string;
  position: number;
  status: PhotoStatus;
  created_at: string;
}

export interface Listing {
  id: string;
  operator_id: string;
  user_id: string;
  kind: OperatorKind;
  title: string;
  description: string | null;
  price: number;
  weekend_price: number | null;
  deposit: number | null;
  latitude: number;
  longitude: number;
  area_label: string;
  service_radius_km: number | null;
  details: CarDetails & HomestayDetails;
  insurance_expires_on: string | null;
  status: ListingStatus;
  review_note: string | null;
  reviewed_at: string | null;
  approved_hash: string | null;
  created_at: string;
  updated_at: string;
  photos?: ListingPhoto[];
  blocks?: { day: string }[];
}

export type ListingInput = Pick<Listing, 'title' | 'description' | 'price' | 'weekend_price' | 'deposit' | 'latitude' | 'longitude' | 'area_label' | 'service_radius_km' | 'details' | 'insurance_expires_on'>;

export const PHOTO_LIMIT: Record<OperatorKind, number> = { car_rental: 8, homestay: 12 };
export const LISTING_LIMIT = 10;
export const LISTINGS_BUCKET = 'listing-photos';
const COLS = 'id,operator_id,user_id,kind,title,description,price,weekend_price,deposit,latitude,longitude,area_label,service_radius_km,details,insurance_expires_on,status,review_note,reviewed_at,approved_hash,created_at,updated_at';
const PHOTO_COLS = 'id,listing_id,path,position,status,created_at';

function client() {
  if (!supabase) throw new Error('Not connected.');
  return supabase;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
function normalize(l: Listing): Listing {
  return {
    ...l,
    price: Number(l.price),
    weekend_price: num(l.weekend_price),
    deposit: num(l.deposit),
    photos: (l.photos ?? []).slice().sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
  };
}

export async function fetchMyListings(operatorId: string): Promise<Listing[]> {
  const { data, error } = await client()
    .from('listings')
    .select(`${COLS},photos:listing_photos(${PHOTO_COLS}),blocks:listing_blocks(day)`)
    .eq('operator_id', operatorId)
    .order('created_at');
  if (error) throw toReportError(error);
  return ((data ?? []) as Listing[]).map(normalize);
}

/** Create or update. `status` is what the owner asks for; the database decides (review rules). */
export async function saveListing(operatorId: string, userId: string, input: ListingInput, status: 'draft' | 'pending' | 'live' | 'paused', id?: string): Promise<Listing> {
  const row = { ...input, operator_id: operatorId, user_id: userId, kind: 'homestay', status };
  const q = id ? client().from('listings').update(row).eq('id', id) : client().from('listings').insert(row);
  const { data, error } = await q.select(COLS).single();
  if (error) throw toReportError(error);
  return normalize(data as Listing);
}

export async function deleteListing(l: Listing): Promise<void> {
  const paths = (l.photos ?? []).map((p) => p.path);
  const { error } = await client().from('listings').delete().eq('id', l.id);
  if (error) throw toReportError(error);
  if (paths.length) await client().storage.from(LISTINGS_BUCKET).remove(paths);
}

export async function uploadListingPhoto(userId: string, listingId: string, file: File, position: number): Promise<ListingPhoto> {
  const blob = await preparePhoto(file, 1600);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await client().storage.from(LISTINGS_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { data, error } = await client().from('listing_photos').insert({ listing_id: listingId, user_id: userId, path, position }).select(PHOTO_COLS).single();
  if (error) {
    await client().storage.from(LISTINGS_BUCKET).remove([path]);
    throw toReportError(error);
  }
  return data as ListingPhoto;
}

export async function deleteListingPhoto(p: ListingPhoto): Promise<void> {
  const { error } = await client().from('listing_photos').delete().eq('id', p.id);
  if (error) throw toReportError(error);
  await client().storage.from(LISTINGS_BUCKET).remove([p.path]);
}

/** Make this photo the cover (position 0) and shift the others after it. */
export async function makeCover(photos: ListingPhoto[], coverId: string): Promise<ListingPhoto[]> {
  const ordered = [photos.find((p) => p.id === coverId)!, ...photos.filter((p) => p.id !== coverId)];
  await Promise.all(ordered.map((p, i) => (p.position === i ? null : client().from('listing_photos').update({ position: i }).eq('id', p.id))));
  return ordered.map((p, i) => ({ ...p, position: i }));
}

export async function listingPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client().storage.from(LISTINGS_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

export async function setBlocked(listingId: string, day: string, blocked: boolean): Promise<void> {
  const q = blocked
    ? client().from('listing_blocks').insert({ listing_id: listingId, day })
    : client().from('listing_blocks').delete().eq('listing_id', listingId).eq('day', day);
  const { error } = await q;
  if (error && error.code !== '23505') throw toReportError(error);
}

/* ─── admin ─── */
export interface ListingForReview extends Listing {
  operator: { business_name: string; phone: string; kind: OperatorKind } | null;
}

/** Listings waiting for review, and live listings with photos waiting. */
export async function fetchListingsForReview(): Promise<ListingForReview[]> {
  const { data, error } = await client()
    .from('listings')
    .select(`${COLS},photos:listing_photos(${PHOTO_COLS}),operator:operators(business_name,phone,kind)`)
    .in('status', ['pending', 'live', 'paused'])
    .order('updated_at')
    .limit(200);
  if (error) throw toReportError(error);
  return ((data ?? []) as unknown as ListingForReview[])
    .map((l) => ({ ...normalize(l), operator: l.operator }))
    .filter((l) => l.status === 'pending' || (l.photos ?? []).some((p) => p.status === 'pending'));
}

export async function reviewListing(id: string, approve: boolean, note?: string): Promise<void> {
  const { error } = await client().rpc('admin_review_listing', { p_listing: id, p_approve: approve, p_note: note ?? null });
  if (error) throw toReportError(error);
  adminChanged();
}

export async function reviewListingPhoto(id: string, approve: boolean): Promise<void> {
  const { error } = await client().rpc('admin_review_listing_photo', { p_photo: id, p_approve: approve });
  if (error) throw toReportError(error);
  adminChanged();
}
