import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useCameras } from '@/contexts/CamerasContext';
import { useMapContext } from '@/contexts/MapContext';

/** Small camera badges for fixed AES/AWAS cameras on the route. */
export function CameraMarkers() {
  const { map } = useMapContext();
  const { ahead } = useCameras();
  const markers = useRef(new Map<string, mapboxgl.Marker>());

  useEffect(() => {
    if (!map) return;
    const want = new Set(ahead.map((c) => c.item.id));
    for (const c of ahead) {
      if (markers.current.has(c.item.id)) continue;
      const el = document.createElement('div');
      el.setAttribute('aria-label', `Speed camera${c.limit ? `, limit ${c.limit}` : ''}`);
      el.innerHTML = `<div style="display:flex;align-items:center;gap:2px;padding:3px 6px;border-radius:9999px;background:#1e293b;border:2px solid #fff;box-shadow:0 2px 5px rgb(0 0 0 / .4);color:#fff;font:700 11px system-ui">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97"/><path d="M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z"/><path d="M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15"/><path d="M2 21v-4"/><path d="M7 9h.01"/></svg>
        ${c.limit ?? ''}</div>`;
      markers.current.set(c.item.id, new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([c.item.lng, c.item.lat]).addTo(map));
    }
    markers.current.forEach((m, id) => {
      if (want.has(id)) return;
      m.remove();
      markers.current.delete(id);
    });
  }, [map, ahead]);

  useEffect(() => {
    const all = markers.current;
    return () => {
      all.forEach((m) => m.remove());
      all.clear();
    };
  }, []);
  return null;
}
