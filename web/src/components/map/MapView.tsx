import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPinOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useTheme } from '@/contexts/ThemeContext';
import { DEFAULT_CENTER, DEFAULT_ZOOM, env, features } from '@/lib/config';
import { styleFor } from '@/lib/mapStyles';
import { useIsNavigating, useRouting } from '@/contexts/RoutingContext';
import { DestinationMarker } from './DestinationMarker';
import { NavigationCamera } from './NavigationCamera';
import { RouteLayer } from './RouteLayer';
import { ReportMarkers } from '@/components/reports/ReportMarkers';
import { ShortcutLayer } from '@/components/shortcuts/ShortcutLayer';
import { UserLocationMarker } from './UserLocationMarker';

if (env.mapboxToken) mapboxgl.accessToken = env.mapboxToken;

/**
 * Full-screen map. Mounted once in the app layout so switching tabs never
 * re-creates the map (keeps it fast and avoids extra map loads).
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, setMap, following, setFollowing, selectedPlace, tileError, setTileError } = useMapContext();
  const { theme } = useTheme();
  const { fix } = useLocation();
  const { destination } = useRouting();
  const navigating = useIsNavigating();
  const markerPlace = destination ?? selectedPlace;
  const [initError, setInitError] = useState<string | null>(null);
  const initialTheme = useRef(theme);
  const appliedTheme = useRef(theme);
  const centeredOnUser = useRef(false);

  // Create the map once
  useEffect(() => {
    if (!containerRef.current) return;
    let instance: mapboxgl.Map;
    try {
      instance = new mapboxgl.Map({
        container: containerRef.current,
        style: styleFor(initialTheme.current, features.mapboxTiles),
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        pitchWithRotate: true,
        maxPitch: 60,
        cooperativeGestures: false,
      });
    } catch (err) {
      console.error('[JalanGo] map init failed', err);
      setInitError('Your browser could not start the map (WebGL may be disabled).');
      return;
    }

    // Handy for debugging in the browser console during development
    if (import.meta.env.DEV) (window as unknown as { __jalangoMap?: mapboxgl.Map }).__jalangoMap = instance;

    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    instance.addControl(new mapboxgl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-left');

    let warned = false;
    instance.on('error', (e) => {
      const status = (e.error as { status?: number } | undefined)?.status;
      if (!warned) console.warn('[JalanGo] map error (further errors suppressed)', e.error);
      warned = true;
      if (status === 401 || status === 403) setInitError('The Mapbox token was rejected. Check VITE_MAPBOX_PUBLIC_TOKEN.');
      else setTileError(true);
    });
    // 'style.load' (not 'load') so controls and markers work even while tiles are still loading or failing.
    instance.on('style.load', () => setMap(instance));

    return () => {
      setMap(null);
      instance.remove();
    };
  }, [setMap, setTileError]);

  // Switch light/dark basemap
  useEffect(() => {
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    map.setStyle(styleFor(theme, features.mapboxTiles));
  }, [map, theme]);

  // Stop following when the user drags or rotates the map themselves
  useEffect(() => {
    if (!map) return;
    const stop = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) setFollowing(false);
    };
    map.on('dragstart', stop);
    map.on('rotatestart', stop);
    return () => {
      map.off('dragstart', stop);
      map.off('rotatestart', stop);
    };
  }, [map, setFollowing]);

  // Centre on the first GPS fix, then keep following if enabled
  useEffect(() => {
    if (!map || !fix) return;
    const center: [number, number] = [fix.coordinates.lng, fix.coordinates.lat];
    if (!centeredOnUser.current) {
      centeredOnUser.current = true;
      if (!selectedPlace) {
        map.jumpTo({ center, zoom: 15 });
        setFollowing(true);
      }
      return;
    }
    // NavigationCamera owns the camera while driving
    if (following && !navigating) map.easeTo({ center, duration: 600 });
  }, [map, fix, following, selectedPlace, setFollowing, navigating]);

  // Tiles recover on their own once connectivity returns
  useEffect(() => {
    if (!map || !tileError) return;
    const clear = () => setTileError(false);
    const id = setTimeout(() => map.once('idle', clear), 8000);
    return () => clearTimeout(id);
  }, [map, tileError, setTileError]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" role="region" aria-label="Map" />
      {map && <UserLocationMarker />}
      {map && markerPlace && <DestinationMarker place={markerPlace} />}
      {map && <RouteLayer />}
      {map && <ShortcutLayer />}
      {map && <ReportMarkers />}
      {map && <NavigationCamera />}

      {initError && (
        <div className="absolute inset-0 grid place-items-center bg-ink-100 p-6 text-center dark:bg-ink-900">
          <div className="max-w-xs">
            <MapPinOff className="mx-auto mb-3 size-10 text-ink-400" />
            <p className="font-semibold">Map unavailable</p>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{initError}</p>
            <p className="mt-3 text-xs text-ink-400">Search, saved places and other tabs still work.</p>
          </div>
        </div>
      )}
      {!initError && !map && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-8 animate-spin rounded-full border-4 border-jade-500/30 border-t-jade-500" aria-label="Loading map" />
        </div>
      )}
    </div>
  );
}
