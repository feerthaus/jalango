import mapboxgl from 'mapbox-gl';
import { MapPinPlus, X } from 'lucide-react';
import { useEffect } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';

/** Purple pin for the stop on the way (e.g. lunch). */
export function StopMarker() {
  const { map } = useMapContext();
  const { stop } = useRouting();
  const lat = stop?.coordinates.lat;
  const lng = stop?.coordinates.lng;
  const name = stop?.name ?? '';
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    const el = document.createElement('div');
    el.setAttribute('aria-label', `Stop: ${name}`);
    el.innerHTML = `
      <svg width="32" height="41" viewBox="0 0 36 46" style="filter:drop-shadow(0 3px 4px rgb(0 0 0 / .35))">
        <path d="M18 45s15-15.2 15-27A15 15 0 0 0 3 18c0 11.8 15 27 15 27Z" fill="#7c3aed" stroke="white" stroke-width="2.5"/>
        <path d="M13 12v6a3 3 0 0 0 6 0v-6M16 12v14M23 12c-2 0-3 2-3 5s1 4 3 4v5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>`;
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, lat, lng, name]);
  return null;
}

/** "Singgah: Restoran X" pill during navigation. */
export function StopBanner() {
  const { stop, clearStop } = useRouting();
  if (!stop) return null;
  return (
    <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-violet-600 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-white shadow-float">
      <MapPinPlus className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Singgah: {stop.name}</span>
      <button type="button" onClick={clearStop} aria-label="Batal singgah" className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-violet-700">
        <X className="size-3.5" /> Batal
      </button>
    </div>
  );
}
