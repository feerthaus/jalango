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
