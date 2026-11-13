import { deviceId } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { listingPhotoUrls, type Listing } from './listingService';
import type { OperatorKind } from './operatorService';
import { toReportError } from './reportsService';

/** What renters see about an operator (approved operators only). */
export interface PublicOperator {
  id: string;
  kind: OperatorKind;
  business_name: string;
  state: string;
  town: string;
  phone: string;
  description: string | null;
  ssm_verified: boolean;
  apad_licensed: boolean;
  insured: boolean;
  approved_at: string | null;
}

export interface PublicListing extends Listing {
  operator: PublicOperator;
  /** signed URLs of approved photos, cover first */
  photoUrls: string[];
}

export type ListingAction = 'view' | 'whatsapp' | 'call' | 'directions';

const COLS = 'id,operator_id,user_id,kind,title,description,price,weekend_price,deposit,latitude,longitude,area_label,service_radius_km,details,insurance_expires_on,status,review_note,reviewed_at,approved_hash,created_at,updated_at';

function client() {
  if (!supabase) throw new Error('Tidak bersambung.');
  return supabase;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function attach(rows: Listing[]): Promise<PublicListing[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((l) => l.operator_id))];
  const { data: ops, error } = await client().rpc('listing_operators', { p_ids: ids });
  if (error) throw toReportError(error);
  const byId = new Map(((ops ?? []) as PublicOperator[]).map((o) => [o.id, o]));
  const sorted = rows.map((l) => ({ ...l, photos: (l.photos ?? []).slice().sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)) }));
  const urls = await listingPhotoUrls(sorted.flatMap((l) => (l.photos ?? []).map((p) => p.path)));
  return sorted.flatMap((l) => {
    const operator = byId.get(l.operator_id);
    if (!operator) return [];
    return [{
      ...l,
      price: Number(l.price),
      weekend_price: num(l.weekend_price),
      deposit: num(l.deposit),
      operator,
      photoUrls: (l.photos ?? []).flatMap((p) => (urls[p.path] ? [urls[p.path]] : [])),
    }];
  });
}

/** Live listings from approved operators (RLS only returns those), optionally one kind. */
export async function fetchPublicListings(kind?: OperatorKind): Promise<PublicListing[]> {
  let q = client().from('listings').select(`${COLS},photos:listing_photos(id,listing_id,path,position,status,created_at)`).eq('status', 'live');
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(300);
  if (error) throw toReportError(error);
  return attach((data ?? []) as Listing[]);
}

export async function fetchPublicListing(id: string): Promise<PublicListing | null> {
  const { data, error } = await client()
    .from('listings')
    .select(`${COLS},photos:listing_photos(id,listing_id,path,position,status,created_at),blocks:listing_blocks(day)`)
    .eq('id', id)
    .eq('status', 'live')
    .maybeSingle();
  if (error) throw toReportError(error);
  if (!data) return null;
  return (await attach([data as Listing]))[0] ?? null;
}

/** Counted once per phone, listing, action and day. Never blocks the UI. */
export function logListingEvent(listingId: string, action: ListingAction): void {
  const id = deviceId();
  if (!supabase || !id) return;
  void supabase.rpc('log_listing_event', { p_listing: listingId, p_action: action, p_device: id }).then(
    () => undefined,
    () => undefined,
  );
}

export interface ListingStats {
  views: number;
  whatsapp: number;
  calls: number;
  directions: number;
}

/** The signed-in owner's numbers for the last 30 days, by listing. */
export async function fetchMyListingStats(): Promise<Record<string, ListingStats>> {
  const { data, error } = await client().rpc('my_listing_stats');
  if (error) throw toReportError(error);
  return Object.fromEntries(
    ((data ?? []) as ({ listing_id: string } & Record<keyof ListingStats, number | string>)[]).map((r) => [
      r.listing_id,
      { views: Number(r.views), whatsapp: Number(r.whatsapp), calls: Number(r.calls), directions: Number(r.directions) },
    ]),
  );
}
