import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createLocalPlaceStore, RECENTS_LIMIT, toSaved } from '@/services/placeStore';
import type { Place, SavedPlace } from '@/types';

interface SavedPlacesValue {
  favourites: SavedPlace[];
  recents: SavedPlace[];
  isFavourite: (id: string) => boolean;
  toggleFavourite: (place: Place) => void;
  removeFavourite: (id: string) => void;
  addRecent: (place: Place) => void;
  removeRecent: (id: string) => void;
  clearRecents: () => void;
}

const favouritesStore = createLocalPlaceStore('jalango:favourites');
const recentsStore = createLocalPlaceStore('jalango:recents');
const SavedPlacesContext = createContext<SavedPlacesValue | null>(null);

export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<SavedPlace[]>(() => favouritesStore.list());
  const [recents, setRecents] = useState<SavedPlace[]>(() => recentsStore.list());

  const updateFavourites = useCallback((fn: (prev: SavedPlace[]) => SavedPlace[]) => {
    setFavourites((prev) => {
      const next = fn(prev);
      favouritesStore.save(next);
      return next;
    });
  }, []);

  const updateRecents = useCallback((fn: (prev: SavedPlace[]) => SavedPlace[]) => {
    setRecents((prev) => {
      const next = fn(prev);
      recentsStore.save(next);
      return next;
    });
  }, []);

  const value = useMemo<SavedPlacesValue>(() => {
    const favIds = new Set(favourites.map((f) => f.id));
    return {
      favourites,
      recents,
      isFavourite: (id) => favIds.has(id),
      toggleFavourite: (place) =>
        updateFavourites((prev) =>
          prev.some((p) => p.id === place.id) ? prev.filter((p) => p.id !== place.id) : [toSaved(place), ...prev],
        ),
      removeFavourite: (id) => updateFavourites((prev) => prev.filter((p) => p.id !== id)),
      addRecent: (place) =>
        updateRecents((prev) => [toSaved(place), ...prev.filter((p) => p.id !== place.id)].slice(0, RECENTS_LIMIT)),
      removeRecent: (id) => updateRecents((prev) => prev.filter((p) => p.id !== id)),
      clearRecents: () => updateRecents(() => []),
    };
  }, [favourites, recents, updateFavourites, updateRecents]);

  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

export function useSavedPlaces(): SavedPlacesValue {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error('useSavedPlaces must be used within SavedPlacesProvider');
  return ctx;
}
