import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useTrainView } from '@/lib/trainView';

const SOURCE = 'jg-signals';
const LAYER = 'jg-signals';
const ICON = 'jg-traffic-light';

/** The same little traffic light as the banner badge, drawn for the map. */
function trafficLightImage(): ImageData | null {
  try {
    const w = 28;
    const h = 56;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#111827';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(2, 2, w - 4, h - 4, 8);
    else g.rect(2, 2, w - 4, h - 4);
    g.fill();
    g.stroke();
    ['#ef4444', '#f59e0b', '#22c55e'].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(w / 2, 14 + i * 14, 5, 0, Math.PI * 2);
      g.fill();
    });
    return g.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

function ensure(map: MapboxMap, data: FeatureCollection<Point>) {
  const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  if (!map.hasImage(ICON)) {
    const img = trafficLightImage();
    if (!img) return;
    map.addImage(ICON, img, { pixelRatio: 2 });
  }
  map.addSource(SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: LAYER,
    type: 'symbol',
    source: SOURCE,
    minzoom: 13.5,
    layout: {
      'icon-image': ICON,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13.5, 0.6, 16, 0.85, 18, 1.1] as never,
      'icon-anchor': 'bottom',
      'icon-offset': [0, -4],
      'icon-allow-overlap': true,
      'icon-pitch-alignment': 'viewport',
    },
  });
}

/**
 * Traffic lights on the selected route, where the map data has them (Mapbox's
 * `traffic_signal` on the route's junctions). Shown once zoomed in to street
 * level, so they never clutter the overview.
 */
export function TrafficSignalLayer() {
  const { map } = useMapContext();
  const { selectedRoute } = useRouting();
  const trainShown = Boolean(useTrainView());
  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: trainShown ? [] : (selectedRoute?.signals ?? []).map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: {} })),
    }),
    [selectedRoute, trainShown],
  );

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        ensure(map, data);
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
