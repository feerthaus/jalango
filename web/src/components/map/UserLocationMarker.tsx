import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';

/** Pulsing GPS puck with heading cone, rendered as a DOM marker (survives style changes). */
export function UserLocationMarker() {
  const { map } = useMapContext();
  const { fix } = useLocation();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.className = 'relative grid size-6 place-items-center';
    el.setAttribute('aria-label', 'Your location');
    el.innerHTML = `
      <span data-heading class="absolute -top-3 left-1/2 hidden h-5 w-4 -translate-x-1/2 origin-[50%_150%]" style="clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(to top, rgb(20 196 147 / .9), rgb(20 196 147 / 0))"></span>
      <span class="absolute inset-0 animate-pulse-ring rounded-full bg-jade-500/40"></span>
      <span class="relative size-4 rounded-full border-[3px] border-white bg-jade-500 shadow-[0_0_0_1px_rgb(0_0_0/.15),0_2px_6px_rgb(0_0_0/.35)]"></span>`;
    elRef.current = el;
    markerRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!fix) {
      marker.remove();
      return;
    }
    marker.setLngLat([fix.coordinates.lng, fix.coordinates.lat]);
    if (!marker.getElement().isConnected) marker.addTo(map);

    const cone = elRef.current?.querySelector<HTMLElement>('[data-heading]');
    if (cone) {
      const showHeading = fix.heading !== null && (fix.speed ?? 0) > 0.5;
      cone.classList.toggle('hidden', !showHeading);
      if (showHeading) cone.style.transform = `translateX(-50%) rotate(${fix.heading}deg)`;
    }
  }, [map, fix]);

  return null;
}
