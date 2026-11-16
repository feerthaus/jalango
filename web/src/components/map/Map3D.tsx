import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating } from '@/contexts/RoutingContext';
import { useTheme, type ResolvedTheme } from '@/contexts/ThemeContext';
import { BUILDINGS_LAYER, buildingSupport, buildingsBeforeId, buildingsLayer, PITCH_3D, type MapMode } from '@/lib/map3d';

/** Show or hide 3D buildings in whatever way the loaded style supports. Safe to call repeatedly. */
export function applyBuildings(map: MapboxMap, on: boolean, theme: ResolvedTheme): void {
  const style = map.getStyle() as ReturnType<MapboxMap['getStyle']> & { imports?: { id: string }[] };
  const support = buildingSupport(style);
  if (support === 'config') {
    map.setConfigProperty('basemap', 'show3dObjects', on);
    return;
  }
  const has = Boolean(map.getLayer(BUILDINGS_LAYER));
  if (!on || support !== 'extrusion') {
    if (has) map.removeLayer(BUILDINGS_LAYER);
    return;
  }
  if (has) {
    // theme changed while on: recolour instead of re-adding
    const l = buildingsLayer(theme);
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-color', l.paint!['fill-extrusion-color']);
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-opacity', l.paint!['fill-extrusion-opacity']);
    return;
  }
  map.addLayer(buildingsLayer(theme), buildingsBeforeId(style?.layers ?? []));
}

/**
 * 3D mode: buildings (re-applied after every style load, e.g. a light/dark
 * switch) and one smooth camera move when the mode changes. While driving,
 * NavigationCamera owns the camera; this never fights the user's own gestures.
 */
export function Map3D() {
  const { map, mapMode, following } = useMapContext();
  const { theme } = useTheme();
  const navigating = useIsNavigating();
  const lastMode = useRef<MapMode | null>(null);

  // Buildings: now, and again whenever the style reloads
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        applyBuildings(map, mapMode === '3d', theme);
      } catch {
        /* style not ready yet: the next 'style.load' calls us again */
      }
    };
    apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, mapMode, theme]);

  // Camera: only when the mode actually changes (not on mount, not continuously)
  useEffect(() => {
    if (!map) return;
    const prev = lastMode.current;
    lastMode.current = mapMode;
    if (prev === null || prev === mapMode) return;
    if (navigating && following) return; // NavigationCamera applies the new tilt on the next fix
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : 900;
    if (mapMode === '3d') {
      map.easeTo({ pitch: PITCH_3D, bearing: map.getBearing(), zoom: Math.max(map.getZoom(), 15.5), duration });
    } else {
      map.easeTo({ pitch: 0, bearing: navigating ? map.getBearing() : 0, duration });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mapMode]);

  return null;
}
