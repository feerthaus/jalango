import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { features } from '@/lib/config';
import { styleFor } from '@/lib/mapStyles';

export interface PreviewPin {
  lat: number;
  lng: number;
  color: string;
  label: string;
}

/** Small read-only map for a review record: its pin, and the POI it may duplicate. */
export function PoiMapPreview({ pins }: { pins: PreviewPin[] }) {
  const box = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const key = pins.map((p) => `${p.lat},${p.lng}`).join(';');

  useEffect(() => {
    if (!box.current || pins.length === 0) return;
    let m: mapboxgl.Map;
    try {
      m = new mapboxgl.Map({ container: box.current, style: styleFor(theme === 'dark' ? 'dark' : 'light', features.mapboxTiles), center: [pins[0].lng, pins[0].lat], zoom: 16, attributionControl: false, interactive: true });
    } catch {
      return;
    }
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    for (const p of pins) new mapboxgl.Marker({ color: p.color }).setLngLat([p.lng, p.lat]).setPopup(new mapboxgl.Popup({ offset: 24 }).setText(p.label)).addTo(m);
    if (pins.length > 1) {
      const b = new mapboxgl.LngLatBounds();
      pins.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 60, maxZoom: 18, duration: 0 });
    }
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, theme]);

  return <div ref={box} className="h-56 w-full overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800" aria-label="Peta lokasi rekod" role="img" />;
}
