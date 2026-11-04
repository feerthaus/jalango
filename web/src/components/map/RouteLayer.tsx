import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Congestion, Route } from '@/types';

const SOURCE = 'jg-routes';
const LAYERS = { alt: 'jg-route-alt', casing: 'jg-route-casing', main: 'jg-route-main' } as const;

export const CONGESTION_COLORS: Record<Congestion, string> = {
  unknown: '#14c493',
  low: '#14c493',
  moderate: '#f59e0b',
  heavy: '#ef4444',
  severe: '#991b1b',
};

type Props = { kind: 'alt' | 'main'; index: number; congestion: Congestion; demo: boolean };

/** Selected route split into runs of equal congestion so it can be coloured by live traffic. */
function routeFeatures(routes: Route[], selected: number): FeatureCollection<LineString, Props> {
  const features: Feature<LineString, Props>[] = [];
  routes.forEach((route, index) => {
    const coords = route.geometry.coordinates;
    const demo = route.source === 'demo';
    if (index !== selected) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { kind: 'alt', index, congestion: 'unknown', demo } });
      return;
    }
    const cong = route.congestion;
    if (!cong) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { kind: 'main', index, congestion: 'unknown', demo } });
      return;
    }
    let start = 0;
    for (let i = 1; i <= cong.length; i++) {
      if (i === cong.length || cong[i] !== cong[start]) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords.slice(start, i + 1) },
          properties: { kind: 'main', index, congestion: cong[start], demo },
        });
        start = i;
      }
    }
  });
  return { type: 'FeatureCollection', features };
}

function firstSymbolLayer(map: MapboxMap): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;
}

function ensureLayers(map: MapboxMap, data: FeatureCollection) {
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  const before = firstSymbolLayer(map);
  map.addLayer(
    {
      id: LAYERS.alt,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'alt'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#8f9bb3', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 16, 9], 'line-opacity': 0.85 },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYERS.casing,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'main'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0b1220', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 16, 14], 'line-opacity': 0.55 },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYERS.main,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'main'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['match', ['get', 'congestion'], 'moderate', CONGESTION_COLORS.moderate, 'heavy', CONGESTION_COLORS.heavy, 'severe', CONGESTION_COLORS.severe, CONGESTION_COLORS.low],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4.5, 16, 9],
        'line-dasharray': ['case', ['get', 'demo'], ['literal', [1.5, 1.5]], ['literal', [1, 0]]],
      },
    },
    before,
  );
}

/** Draws route alternatives + the selected route (coloured by live congestion) and frames them. */
export function RouteLayer() {
  const { map } = useMapContext();
  const { routes, selectedIndex, selectRoute, status } = useRouting();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const data = useMemo(() => routeFeatures(routes, selectedIndex), [routes, selectedIndex]);
  const navigating = status === 'navigating' || status === 'arrived';

  // Keep layers in sync, and re-add after a style (theme) change wipes them
  useEffect(() => {
    if (!map) return;
    // isStyleLoaded() also waits for tiles, which may never finish offline; just try and
    // fall back to the next 'style.load' if the style itself isn't ready yet.
    const apply = () => {
      try {
        ensureLayers(map, data);
      } catch {
        /* style not ready — 'style.load' will call us again */
      }
    };
    apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, data]);

  // Click an alternative to select it
  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: [LAYERS.alt] })[0];
      const idx = f?.properties?.index;
      if (typeof idx === 'number') selectRoute(idx);
    };
    const enter = () => (map.getCanvas().style.cursor = 'pointer');
    const leave = () => (map.getCanvas().style.cursor = '');
    map.on('click', LAYERS.alt, onClick);
    map.on('mouseenter', LAYERS.alt, enter);
    map.on('mouseleave', LAYERS.alt, leave);
    return () => {
      map.off('click', LAYERS.alt, onClick);
      map.off('mouseenter', LAYERS.alt, enter);
      map.off('mouseleave', LAYERS.alt, leave);
    };
  }, [map, selectRoute]);

  // Frame all routes when a new set arrives (not while driving)
  useEffect(() => {
    if (!map || navigating || routes.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const r of routes)
      for (const [lng, lat] of r.geometry.coordinates) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    const h = map.getContainer().clientHeight;
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: isDesktop ? { top: 80, bottom: 80, left: 460, right: 80 } : { top: 90, bottom: Math.min(h * 0.5, 420), left: 40, right: 40 },
        maxZoom: 16,
        duration: 800,
        pitch: 0,
        bearing: 0,
      },
    );
  }, [map, routes, navigating, isDesktop]);

  return null;
}
