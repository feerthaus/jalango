import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { useVehiclePose } from '@/hooks/useVehiclePose';
import { lerp, lerpAngle } from '@/utils/motion';
import { shade } from '@/utils/convoy';

/** Top-down car (pointing up), drawn in SVG so it stays crisp at any size. */
export const CAR_SVG = `
<svg viewBox="0 0 48 72" width="34" height="51" aria-hidden="true" style="display:block;filter:drop-shadow(0 3px 4px rgb(0 0 0 / .45))">
  <defs>
    <linearGradient id="jg-car-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0aa07a"/><stop offset=".5" stop-color="#34d9ad"/><stop offset="1" stop-color="#0aa07a"/>
    </linearGradient>
    <linearGradient id="jg-car-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e2a44"/><stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <!-- tyres -->
  <rect x="4" y="12" width="6" height="12" rx="2.5" fill="#0b1220"/>
  <rect x="38" y="12" width="6" height="12" rx="2.5" fill="#0b1220"/>
  <rect x="4" y="48" width="6" height="12" rx="2.5" fill="#0b1220"/>
  <rect x="38" y="48" width="6" height="12" rx="2.5" fill="#0b1220"/>
  <!-- body -->
  <path d="M24 2c10 0 16 5 17 13l1 41c0 8-6 14-18 14S6 64 6 56l1-41C8 7 14 2 24 2Z" fill="url(#jg-car-body)" stroke="#fff" stroke-width="2.5"/>
  <!-- bonnet line + headlights -->
  <path d="M15 10c5-2 13-2 18 0" stroke="#0b7f63" stroke-width="1.5" fill="none" opacity=".6"/>
  <rect x="11" y="4.5" width="7" height="3.5" rx="1.7" fill="#fff8d6"/>
  <rect x="30" y="4.5" width="7" height="3.5" rx="1.7" fill="#fff8d6"/>
  <!-- windscreen, roof, rear window -->
  <path d="M12 22c3-4 21-4 24 0l-2 9H14l-2-9Z" fill="url(#jg-car-glass)"/>
  <rect x="14" y="31" width="20" height="17" rx="3" fill="#2fd1a6"/>
  <path d="M14 48h20l2 7c-4 3-20 3-24 0l2-7Z" fill="url(#jg-car-glass)"/>
  <!-- tail lights -->
  <rect x="10" y="64" width="7" height="3" rx="1.5" fill="#ff3b30"/>
  <rect x="31" y="64" width="7" height="3" rx="1.5" fill="#ff3b30"/>
</svg>`;

/**
 * The same car in any colour (used for convoy members). `uid` keeps the SVG
 * gradient ids unique when several cars are on screen.
 */
export function carSvg(color: string, uid: string, width = 30): string {
  const height = Math.round(width * 1.5);
  return CAR_SVG.replaceAll('jg-car-', `jg-car-${uid}-`)
    .replace('width="34" height="51"', `width="${width}" height="${height}"`)
    .replaceAll('#0aa07a', shade(color, -0.25))
    .replace('#34d9ad', shade(color, 0.25))
    .replace('#0b7f63', shade(color, -0.45))
    .replace('#2fd1a6', shade(color, 0.1));
}

/**
 * The driver's car. Positions are interpolated between GPS fixes every
 * animation frame (and snapped to the road while navigating), so it glides
 * like a real car instead of jumping from point to point.
 */
export function UserLocationMarker() {
  const { map } = useMapContext();
  const pose = useVehiclePose();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const shown = useRef<{ lng: number; lat: number; bearing: number } | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.className = 'relative grid place-items-center';
    el.setAttribute('aria-label', 'Your location');
    el.innerHTML = `<span class="absolute size-10 animate-pulse-ring rounded-full bg-jade-500/35"></span>${CAR_SVG}`;
    markerRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      markerRef.current?.remove();
      markerRef.current = null;
      shown.current = null;
    };
  }, [map]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (!pose) {
      marker.remove();
      shown.current = null;
      return;
    }
    const target = { lng: pose.position.lng, lat: pose.position.lat, bearing: pose.bearing };
    const from = shown.current;
    if (!marker.getElement().isConnected) marker.setLngLat([target.lng, target.lat]).addTo(map);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (frame.current) cancelAnimationFrame(frame.current);
    if (!from || pose.duration === 0 || reduceMotion) {
      shown.current = target;
      marker.setLngLat([target.lng, target.lat]).setRotation(target.bearing);
      return;
    }
    // Teleports (e.g. first fix after a long gap) shouldn't animate across the map
    const jump = Math.abs(from.lat - target.lat) + Math.abs(from.lng - target.lng) > 0.02;
    if (jump) {
      shown.current = target;
      marker.setLngLat([target.lng, target.lat]).setRotation(target.bearing);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / pose.duration);
      const cur = { lng: lerp(from.lng, target.lng, t), lat: lerp(from.lat, target.lat, t), bearing: lerpAngle(from.bearing, target.bearing, Math.min(1, t * 1.6)) };
      shown.current = cur;
      marker.setLngLat([cur.lng, cur.lat]).setRotation(cur.bearing);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [map, pose]);

  return null;
}
