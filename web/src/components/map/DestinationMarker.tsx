import mapboxgl from 'mapbox-gl';
import { useEffect } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import type { Place } from '@/types';

export function DestinationMarker({ place }: { place: Place }) {
  const { map } = useMapContext();

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.setAttribute('aria-label', `Selected: ${place.name}`);
    el.innerHTML = `
      <svg width="36" height="46" viewBox="0 0 36 46" fill="none" style="filter:drop-shadow(0 4px 6px rgb(0 0 0 / .35))">
        <path d="M18 45s15-15.2 15-27A15 15 0 0 0 3 18c0 11.8 15 27 15 27Z" fill="#ef4444" stroke="white" stroke-width="2.5"/>
        <circle cx="18" cy="18" r="5.5" fill="white"/>
      </svg>`;
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([place.coordinates.lng, place.coordinates.lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, place]);

  return null;
}
