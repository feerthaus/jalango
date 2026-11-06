import type { GeoJSONSource } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import type { Shortcut } from '@/types';

const SOURCE = 'jg-shortcuts';
const LAYER = 'jg-shortcut-line';

/** Draws the selected / active community shortcut as a violet dashed line above the route. */
export function ShortcutLayer() {
  const { map } = useMapContext();
  const { selectedShortcut } = useShortcuts();
  const { shortcut: active } = useRouting();

  const data = useMemo<FeatureCollection>(() => {
    const list: Shortcut[] = [];
    if (selectedShortcut) list.push(selectedShortcut);
    if (active && active.id !== selectedShortcut?.id) list.push(active);
    return {
      type: 'FeatureCollection',
      features: list.map((s) => ({ type: 'Feature', properties: { id: s.id }, geometry: { type: 'LineString', coordinates: s.path } })),
    };
  }, [selectedShortcut, active]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
        if (src) {
          src.setData(data);
          return;
        }
        map.addSource(SOURCE, { type: 'geojson', data });
        map.addLayer({
          id: LAYER,
          type: 'line',
          source: SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#8b5cf6',
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 3, 13, 6, 17, 11],
            'line-dasharray': [2, 1.2],
          },
        });
      } catch {
        /* style not ready yet */
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
