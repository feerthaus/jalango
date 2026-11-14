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
  source: 'mapbox' | 'demo' | 'osm' | 'link' | 'google';
  distanceMeters?: number;
}

export type Congestion = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuver: { type: string; modifier?: string; location: Coordinates; bearingAfter?: number; exit?: number };
  roadName?: string;
  /** Road reference number, e.g. "E1" or "FT2" */
  roadRef?: string;
  /** step is on a motorway / divided highway */
  motorway?: boolean;
  /** signposted destinations of a ramp, e.g. "Johor Bahru, Kuala Lumpur" */
  destinations?: string;
  /** lanes at this maneuver, left to right; `valid` = lanes you can use */
  lanes?: { indications: string[]; valid: boolean }[];
  /** motorway exit number(s) signposted for this maneuver, e.g. "111" */
  exits?: string;
}

/** A toll plaza (booth) or open-road gantry the route passes. */
export interface TollPoint {
  type: 'booth' | 'gantry';
  name?: string;
  location: Coordinates;
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
  /** toll plazas / gantries along the route, in order */
  tollPoints?: TollPoint[];
  hasMotorway: boolean;
  /** Per-segment live congestion (length = coordinates - 1) */
  congestion?: Congestion[];
  source: 'mapbox' | 'demo' | 'osm' | 'link';
  /** speed limit (km/h) per geometry segment, null where unknown */
  maxspeeds?: (number | null)[];
}
