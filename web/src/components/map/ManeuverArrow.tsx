import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { bearingDeg, buildRouteIndex, routeSegment } from '@/utils/routeProgress';
import { isRealTurn } from '@/utils/turnFocus';

const SOURCE = 'jg-maneuver';
const LAYERS = { casing: 'jg-maneuver-casing', line: 'jg-maneuver-line', head: 'jg-maneuver-head' } as const;
const HEAD = 'jg-maneuver-arrowhead';
/** Drawn from this far before the turn (the driver sees it coming)… */
const SHOW_WITHIN_M = 600;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** A white arrowhead pointing up (north), rotated on the map to the route's direction. */
function arrowheadImage(): ImageData | null {
  try {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    if (!g) return null;
    g.beginPath();
    g.moveTo(size / 2, 4);
    g.lineTo(size - 6, size - 10);
    g.lineTo(6, size - 10);
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 6;
    g.strokeStyle = '#0a1a3a';
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fill();
    return g.getImageData(0, 0, size, size);
  } catch {
    return null;
  }
}

function ensureLayers(map: MapboxMap, data: FeatureCollection) {
  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  if (!map.hasImage(HEAD)) {
    const img = arrowheadImage();
    if (img) map.addImage(HEAD, img, { pixelRatio: 2 });
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  const w = (base: number) => ['interpolate', ['exponential', 1.5], ['zoom'], 13, base * 0.5, 16, base, 18, base * 2] as never;
  const layout = { 'line-join': 'round', 'line-cap': 'round' } as const;
  // On top of the route and the roads, so it's the first thing the eye lands on
  map.addLayer({ id: LAYERS.casing, type: 'line', source: SOURCE, filter: ['==', ['geometry-type'], 'LineString'], layout, paint: { 'line-color': '#0a1a3a', 'line-width': w(11) } });
  map.addLayer({ id: LAYERS.line, type: 'line', source: SOURCE, filter: ['==', ['geometry-type'], 'LineString'], layout, paint: { 'line-color': '#ffffff', 'line-width': w(6) } });
  map.addLayer({
    id: LAYERS.head,
    type: 'symbol',
    source: SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'icon-image': HEAD,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.45, 16, 0.8, 18, 1.4] as never,
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

/**
 * While navigating: a white arrow drawn on the road through the next turn,
 * like a road marking, so the driver sees which way at a glance instead of
 * reading the banner. Works on every road (it's the route's own line), not
 * only where there's lane data.
 */
export function ManeuverArrow() {
  const { map } = useMapContext();
  const { selectedRoute: route, status, progress } = useRouting();
  const navigating = status === 'navigating';
  const index = useMemo(() => (route && navigating ? buildRouteIndex(route) : null), [route, navigating]);

  const nextIdx = progress ? progress.stepIndex + 1 : -1;
  const step = route?.steps[nextIdx];
  const show = Boolean(index && progress && isRealTurn(step) && progress.distanceToManeuver <= SHOW_WITHIN_M);
  const fast = step?.motorway;

  const data = useMemo<FeatureCollection>(() => {
    if (!show || !index) return EMPTY;
    const at = index.stepStarts[nextIdx];
    if (at === undefined) return EMPTY;
    const line = routeSegment(index, at - (fast ? 70 : 35), at + (fast ? 45 : 25));
    if (line.length < 2) return EMPTY;
    const a = line[line.length - 2];
    const b = line[line.length - 1];
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} },
        { type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { bearing: bearingDeg(a, b) } },
      ],
    };
  }, [show, index, nextIdx, fast]);

  useEffect(() => {
    if (!map) return;
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

  return null;
}
