import type { Place, SavedPlace } from '@/types';

/**
 * Persistence for favourites and recent destinations.
 *
 * Phase 1 ships a localStorage implementation so guests keep their data.
 * Phase 4 adds a Supabase implementation (saved_locations /
 * recent_destinations tables) behind the same interface.
 */
export interface PlaceStore {
  list(): SavedPlace[];
  save(places: SavedPlace[]): void;
}

export function createLocalPlaceStore(key: string): PlaceStore {
  return {
    list() {
      try {
        const raw = localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? (parsed as SavedPlace[]).filter(isSavedPlace) : [];
      } catch {
        return [];
      }
    },
    save(places) {
      try {
        localStorage.setItem(key, JSON.stringify(places));
      } catch {
        /* storage full or blocked (private mode) — keep in memory only */
      }
    },
  };
}

function isSavedPlace(value: unknown): value is SavedPlace {
  const v = value as SavedPlace;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.coordinates?.lat === 'number' &&
    typeof v.coordinates?.lng === 'number'
  );
}

export const RECENTS_LIMIT = 12;

export function toSaved(place: Place): SavedPlace {
  // distance is relative to where the user was; don't persist it
  const { distanceMeters: _distance, ...rest } = place;
  return { ...rest, savedAt: new Date().toISOString() };
}
