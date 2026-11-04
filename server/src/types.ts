/** Shared shapes returned by the JalanGo API. Mirrored in web/src/types. */
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

export interface Place {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  kind: PlaceKind;
  category?: string;
  /** Where the record came from. `demo` records are sample data. */
  source: 'mapbox' | 'demo';
  distanceMeters?: number;
}

export type Congestion = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: { type: string; modifier?: string; location: Coordinates; bearingAfter?: number };
  roadName?: string;
  /** Road reference number, e.g. "E1" or "FT2" */
  roadRef?: string;
}

export interface Route {
  id: string;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  distanceMeters: number;
  /** Traffic-aware duration */
  durationSeconds: number;
  /** Duration under typical traffic, when the provider reports it */
  typicalDurationSeconds?: number;
  /** Main roads, e.g. "E1, Jalan Duta" */
  summary: string;
  steps: RouteStep[];
  hasTolls: boolean;
  hasMotorway: boolean;
  /** Per-segment live congestion (length = coordinates - 1) */
  congestion?: Congestion[];
  source: 'mapbox' | 'demo';
}
