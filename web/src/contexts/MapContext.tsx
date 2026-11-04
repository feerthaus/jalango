import type { Map as MapboxMap } from 'mapbox-gl';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Coordinates, Place } from '@/types';

interface MapContextValue {
  map: MapboxMap | null;
  setMap: (map: MapboxMap | null) => void;
  /** Camera follows the GPS fix until the user pans the map */
  following: boolean;
  setFollowing: (on: boolean) => void;
  selectedPlace: Place | null;
  /** Select a place, show its card and move the camera to it */
  selectPlace: (place: Place) => void;
  clearSelection: () => void;
  flyTo: (to: Coordinates, zoom?: number) => void;
  /** Basemap tiles are currently failing to load */
  tileError: boolean;
  setTileError: (failed: boolean) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [following, setFollowing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [tileError, setTileError] = useState(false);

  const flyTo = useCallback(
    (to: Coordinates, zoom?: number) => {
      if (!map) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.flyTo({ center: [to.lng, to.lat], zoom: zoom ?? Math.max(map.getZoom(), 14), essential: !reduceMotion, duration: reduceMotion ? 0 : 1200 });
    },
    [map],
  );

  const selectPlace = useCallback(
    (place: Place) => {
      setSelectedPlace(place);
      setFollowing(false);
      const zoom = place.kind === 'place' || place.kind === 'region' ? 12 : place.kind === 'postcode' || place.kind === 'locality' ? 14 : 16;
      flyTo(place.coordinates, zoom);
    },
    [flyTo],
  );

  const clearSelection = useCallback(() => setSelectedPlace(null), []);

  const value = useMemo(
    () => ({ map, setMap, following, setFollowing, selectedPlace, selectPlace, clearSelection, flyTo, tileError, setTileError }),
    [map, following, selectedPlace, selectPlace, clearSelection, flyTo, tileError],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapProvider');
  return ctx;
}
