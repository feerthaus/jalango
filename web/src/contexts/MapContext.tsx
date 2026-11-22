import type { Map as MapboxMap } from 'mapbox-gl';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { readMapMode, saveMapMode, type MapMode } from '@/lib/map3d';
import type { Coordinates, Place } from '@/types';

interface MapContextValue {
  /** The Mapbox map, set once its style has loaded (null before, or if it never loads) */
  map: MapboxMap | null;
  setMap: (map: MapboxMap | null) => void;
  /**
   * The app shell that shows the map is mounted (MapView, always rendered by AppLayout). Unlike `map`, this
   * does not wait for the Mapbox style, so it stays true when the basemap fails.
   */
  mapShell: boolean;
  setMapShell: (mounted: boolean) => void;
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
  /** 2D standard (default) or 3D navigation mode; remembered on this device */
  mapMode: MapMode;
  setMapMode: (m: MapMode) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [mapShell, setMapShell] = useState(false);
  const [following, setFollowing] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [tileError, setTileError] = useState(false);
  const [mapMode, setMapModeState] = useState<MapMode>(readMapMode);
  const setMapMode = useCallback((m: MapMode) => {
    setMapModeState(m);
    saveMapMode(m);
  }, []);

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
    () => ({ map, setMap, mapShell, setMapShell, following, setFollowing, selectedPlace, selectPlace, clearSelection, flyTo, tileError, setTileError, mapMode, setMapMode }),
    [map, mapShell, following, selectedPlace, selectPlace, clearSelection, flyTo, tileError, mapMode, setMapMode],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapProvider');
  return ctx;
}
