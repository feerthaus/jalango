import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useTheme, type ResolvedTheme } from '@/contexts/ThemeContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { buildRouteIndex, sliceRoute } from '@/utils/routeProgress';
import type { Congestion, Route } from '@/types';

const SOURCE = 'jg-routes';
const LAYERS = { alt: 'jg-route-alt', casing: 'jg-route-casing', main: 'jg-route-main', passed: 'jg-route-passed' } as const;

/**
 * Route colours are deliberately NOT green: Mapbox's navigation styles draw
 * free-flowing traffic in green/teal, so the route is a bright blue that stands
 * out, with traffic shown on top of it in amber/red only where it's slow.
 */
export const ROUTE_BLUE = '#2f7bff';
export const CONGESTION_COLORS: Record<Congestion, string> = {
  unknown: ROUTE_BLUE,
  low: ROUTE_BLUE,
  moderate: '#ff9f0a',
  heavy: '#ff3b30',
  severe: '#a8001c',
};

type Props = { kind: 'alt' | 'main' | 'passed'; index: number; congestion: Congestion; demo: boolean };

/** Selected route split into runs of equal congestion so it can be coloured by live traffic. */
function routeFeatures(routes: Route[], selected: number, passed: [number, number][]): FeatureCollection<LineString, Props> {
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
    } else {
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
    }
    if (passed.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: passed }, properties: { kind: 'passed', index, congestion: 'unknown', demo } });
    }
  });
  return { type: 'FeatureCollection', features };
}

/**
 * Insert route layers above every road/traffic line of the basemap but below
 * the labels that come after them, so the route is never hidden by traffic.
 */
function beforeLayerId(map: MapboxMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  let lastLine = -1;
  layers.forEach((l, i) => {
    if (l.type === 'line' && !l.id.startsWith('jg-')) lastLine = i;
  });
  return layers.slice(lastLine + 1).find((l) => l.type === 'symbol' && !l.id.startsWith('jg-'))?.id;
}

const width = (base: number) => ['interpolate', ['exponential', 1.5], ['zoom'], 8, base * 0.45, 13, base * 0.8, 17, base * 1.6] as const;

function applyTheme(map: MapboxMap, theme: ResolvedTheme) {
  if (!map.getLayer(LAYERS.casing)) return;
  const dark = theme === 'dark';
  map.setPaintProperty(LAYERS.casing, 'line-color', dark ? '#ffffff' : '#0a3a8f');
  map.setPaintProperty(LAYERS.casing, 'line-opacity', dark ? 0.9 : 0.85);
  map.setPaintProperty(LAYERS.alt, 'line-color', dark ? '#7d8aa6' : '#8f9bb3');
  map.setPaintProperty(LAYERS.passed, 'line-color', dark ? '#5b6680' : '#a3adc2');
}

function ensureLayers(map: MapboxMap, data: FeatureCollection, theme: ResolvedTheme) {
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  const before = beforeLayerId(map);
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
  map.addLayer(
    {
      id: LAYERS.alt,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'alt'],
      layout,
      paint: { 'line-color': '#8f9bb3', 'line-width': width(7) as never, 'line-opacity': 0.9 },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYERS.casing,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'main'],
      layout,
      paint: { 'line-color': '#0a3a8f', 'line-width': width(13) as never },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYERS.main,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'main'],
      layout,
      paint: {
        'line-color': ['match', ['get', 'congestion'], 'moderate', CONGESTION_COLORS.moderate, 'heavy', CONGESTION_COLORS.heavy, 'severe', CONGESTION_COLORS.severe, ROUTE_BLUE],
        'line-width': width(9) as never,
        'line-dasharray': ['case', ['get', 'demo'], ['literal', [1.5, 1.5]], ['literal', [1, 0]]],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: LAYERS.passed,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'kind'], 'passed'],
      layout,
      paint: { 'line-color': '#a3adc2', 'line-width': width(9.5) as never },
    },
    before,
  );
  applyTheme(map, theme);
}

/** Draws route alternatives + the selected route (coloured by live congestion) and frames them. */
export function RouteLayer() {
  const { map } = useMapContext();
  const { routes, selectedIndex, selectRoute, status, progress } = useRouting();
  const { theme } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const navigating = status === 'navigating' || status === 'arrived';
  const selected = routes[selectedIndex];
  const index = useMemo(() => (selected ? buildRouteIndex(selected) : null), [selected]);
  // Grey out what's already been driven (rounded so we don't redraw for every metre)
  const drivenAlong = navigating && progress ? Math.floor(progress.along / 10) * 10 : 0;
  const passed = useMemo(() => (index && drivenAlong > 0 ? sliceRoute(index, drivenAlong) : []), [index, drivenAlong]);
  const data = useMemo(() => routeFeatures(routes, selectedIndex, passed), [routes, selectedIndex, passed]);

  // Keep layers in sync, and re-add after a style (theme) change wipes them
  useEffect(() => {
    if (!map) return;
    // isStyleLoaded() also waits for tiles, which may never finish offline; just try and
    // fall back to the next 'style.load' if the style itself isn't ready yet.
    const apply = () => {
      try {
        ensureLayers(map, data, theme);
      } catch {
        /* style not ready — 'style.load' will call us again */
      }
    };
    apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [map, data, theme]);

  useEffect(() => {
    if (map) applyTheme(map, theme);
  }, [map, theme]);

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
