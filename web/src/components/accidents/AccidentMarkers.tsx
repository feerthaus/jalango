import mapboxgl from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccidents } from '@/contexts/AccidentsContext';
import { useMapContext } from '@/contexts/MapContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { HOTSPOT_ALERT_MIN } from '@/utils/accidentHotspots';
import { AccidentSpotSheet } from './AccidentSpotSheet';

/** Accident spots on the map: red warning badges with the number of recorded crashes. */
export function AccidentMarkers() {
  const { map, clearSelection } = useMapContext();
  const { hotspots, selected, select } = useAccidents();
  const [t] = useT();
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>());
  const [, force] = useState(0);

  useEffect(() => {
    if (!map) return;
    const cur = markers.current;
    const ids = new Set(hotspots.map((h) => h.id));
    let changed = false;
    for (const [id, m] of cur) {
      if (!ids.has(id)) {
        m.marker.remove();
        cur.delete(id);
        changed = true;
      }
    }
    for (const h of hotspots) {
      const ex = cur.get(h.id);
      if (ex) {
        ex.marker.setLngLat([h.coordinates.lng, h.coordinates.lat]);
        continue;
      }
      const el = document.createElement('div');
      cur.set(h.id, { marker: new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([h.coordinates.lng, h.coordinates.lat]).addTo(map), el });
      changed = true;
    }
    if (changed) force((n) => n + 1);
  }, [map, hotspots]);

  useEffect(
    () => () => {
      for (const m of markers.current.values()) m.marker.remove();
      markers.current.clear();
    },
    [],
  );

  return (
    <>
      {hotspots.map((h) => {
        const m = markers.current.get(h.id);
        if (!m) return null;
        const big = h.count >= HOTSPOT_ALERT_MIN;
        return createPortal(
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearSelection();
              select(h);
            }}
            aria-label={t(`Rekod kemalangan: ${h.count}`, `Accident records: ${h.count}`)}
            className={cn(
              'flex items-center gap-0.5 rounded-full border-2 border-white font-black text-white shadow-md',
              big ? 'bg-red-600 px-2 py-0.5 text-xs' : 'bg-red-500/90 px-1.5 py-0.5 text-[10px]',
              selected?.id === h.id && 'ring-4 ring-red-400/60',
            )}
          >
            <span aria-hidden>⚠</span>
            {h.count}
          </button>,
          m.el,
          h.id,
        );
      })}
      {selected && <AccidentSpotSheet spot={selected} onClose={() => select(null)} />}
    </>
  );
}
