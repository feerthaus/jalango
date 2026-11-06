import type { LineString } from 'geojson';

/* ─── Geography ─────────────────────────────────────────────────────── */

export interface Coordinates {
  lng: number;
  lat: number;
}

export type PlaceKind =
  | 'poi'
  | 'address'
  | 'street'
  | 'postcode'
  | 'locality'
  | 'place'
  | 'district'
  | 'region'
  | 'other';

/** Where a record came from. `demo` = bundled sample data, never live. */
export type DataSource = 'mapbox' | 'demo' | 'community';

export interface Place {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  kind: PlaceKind;
  category?: string;
  source: DataSource;
  distanceMeters?: number;
  postcode?: string;
  state?: string;
}

export interface SavedPlace extends Place {
  savedAt: string;
}

/* ─── GPS ───────────────────────────────────────────────────────────── */

export type GeoStatus =
  | 'idle' // not yet requested
  | 'prompt' // user must grant permission
  | 'locating' // waiting for first fix
  | 'active' // receiving fixes
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure'; // page not served over HTTPS

export interface GeoFix {
  coordinates: Coordinates;
  accuracy: number; // metres
  /** metres/second; null when the device doesn't report it */
  speed: number | null;
  /** degrees from true north; null when stationary/unknown */
  heading: number | null;
  timestamp: number;
}

/* ─── Services ──────────────────────────────────────────────────────── */

export type ServiceMode = 'checking' | 'live' | 'demo';

export interface SearchResponse {
  results: Place[];
  mode: Exclude<ServiceMode, 'checking'>;
  /** Present when the live service failed and we degraded to demo data */
  notice?: string;
}

export type ExploreCategory = 'petrol' | 'rnr' | 'ev' | 'parking' | 'hospital' | 'food';

/* ─── Routing ─────────────────────────────────────────────────────── */

export type Congestion = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: { type: string; modifier?: string; location: Coordinates; bearingAfter?: number };
  roadName?: string;
  /** Road reference number, e.g. "E1" */
  roadRef?: string;
}

export interface Route {
  id: string;
  geometry: LineString;
  distanceMeters: number;
  durationSeconds: number;
  typicalDurationSeconds?: number;
  summary: string;
  steps: RouteStep[];
  hasTolls: boolean;
  hasMotorway: boolean;
  congestion?: Congestion[];
  /** `demo` = straight-line preview, not a road route */
  source: DataSource;
}

/* ─── Community reports (mirrors the SQL schema) ───────────────────── */

export type ReportType =
  | 'accident'
  | 'congestion'
  | 'road_closure'
  | 'hazard'
  | 'flood'
  | 'breakdown'
  | 'construction';

export type ReportStatus = 'active' | 'resolved' | 'expired' | 'removed';

export interface TrafficReport {
  id: string;
  user_id: string;
  report_type: ReportType;
  description: string | null;
  latitude: number;
  longitude: number;
  status: ReportStatus;
  confirm_count: number;
  resolve_count: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type ConfirmationType = 'confirm' | 'resolved';

export interface NewReport {
  type: ReportType;
  description: string;
  coordinates: Coordinates;
}

/* ─── Trip history ─────────────────────────────────────────────────── */

export type TripTag = 'fast_route' | 'accurate_directions' | 'heavy_traffic' | 'wrong_directions' | 'toll_worth_it' | 'good_shortcut';

export interface Trip {
  id: string;
  destination: { name: string; address?: string; coordinates: Coordinates; placeId?: string };
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  arrived: boolean;
  routeSummary?: string;
  rating?: number;
  ratingTags?: TripTag[];
  ratingComment?: string;
  /** Driven path, kept on this device only (for sharing as a shortcut) */
  trace?: [number, number][];
  /** id of the matching row in Supabase when synced */
  remoteId?: string;
}

/* ─── Community shortcuts ──────────────────────────────────────────── */

export interface Shortcut {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  avoids: string | null;
  path: [number, number][];
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  distance_m: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

/* ─── Community picks (best food, attractions …) ───────────────────── */

export type CommunityCategory = 'food' | 'cafe' | 'attraction' | 'nature' | 'stay' | 'other';

export interface CommunityPlace {
  id: string;
  user_id: string;
  name: string;
  category: CommunityCategory;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  recommend_count: number;
  created_at: string;
}
