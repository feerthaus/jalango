import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { carSvg } from '@/components/map/UserLocationMarker';
import { motoSvg } from '@/lib/vehicle';
import { useConvoy, type ConvoyPlace } from '@/contexts/ConvoyContext';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { memberStatus } from '@/utils/convoy';
import { haversineMeters } from '@/utils/geo';
import { lerp } from '@/utils/motion';

interface Car {
  marker: mapboxgl.Marker;
  car: HTMLElement;
  label: HTMLElement;
  heading: number;
  shown: { lng: number; lat: number };
  frame: number | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Other convoy members as coloured cars with their name, gliding between updates. */
export function ConvoyMarkers() {
  const { map } = useMapContext();
  const { members, me, convoy, meetPoint, destination } = useConvoy();
  const { destination: routeDest } = useRouting();
  const cars = useRef(new Map<string, Car>());

  // Keep car noses pointing the right way when the map rotates
  useEffect(() => {
    if (!map) return;
    const onRotate = () => {
      const b = map.getBearing();
      cars.current.forEach((c) => (c.car.style.transform = `rotate(${c.heading - b}deg)`));
    };
    map.on('rotate', onRotate);
    return () => {
      map.off('rotate', onRotate);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    const now = Date.now();
    for (const m of members) {
      if (m.user_id === me?.user_id || m.latitude === null || m.longitude === null) continue;
      seen.add(m.user_id);
      const status = memberStatus(m, now);
      const target = { lng: m.longitude, lat: m.latitude };
      let c = cars.current.get(m.user_id);
      if (!c) {
        const el = document.createElement('div');
        el.className = 'flex flex-col items-center';
        el.setAttribute('aria-label', `Convoy: ${m.display_name}`);
        const car = document.createElement('div');
        car.innerHTML = m.vehicle === 'motorcycle' ? motoSvg(m.color, 20) : carSvg(m.color, m.user_id.slice(0, 8), 28);
        car.style.transition = 'transform .6s ease-out';
        const label = document.createElement('div');
        label.className = 'mt-0.5 max-w-[110px] truncate rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow';
        el.append(car, label);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([target.lng, target.lat]).addTo(map);
        c = { marker, car, label, heading: 0, shown: target, frame: null };
        cars.current.set(m.user_id, c);
      }
      c.label.style.background = m.color;
      c.label.innerHTML = `${esc(m.display_name)}${status === 'offline' ? ' · ⚠︎' : status === 'arrived' ? ' · ✓' : ''}`;
      c.marker.getElement().style.opacity = status === 'offline' ? '0.55' : '1';
      if (m.heading !== null) c.heading = m.heading;
      c.car.style.transform = `rotate(${c.heading - map.getBearing()}deg)`;

      // glide to the new position
      const from = { ...c.shown };
      const car = c;
      if (car.frame) cancelAnimationFrame(car.frame);
      if (haversineMeters(from, target) > 3000 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        car.shown = target;
        car.marker.setLngLat([target.lng, target.lat]);
      } else {
        const start = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / 1500);
          car.shown = { lng: lerp(from.lng, target.lng, k), lat: lerp(from.lat, target.lat, k) };
          car.marker.setLngLat([car.shown.lng, car.shown.lat]);
          car.frame = k < 1 ? requestAnimationFrame(step) : null;
        };
        car.frame = requestAnimationFrame(step);
      }
    }
    cars.current.forEach((c, id) => {
      if (seen.has(id)) return;
      if (c.frame) cancelAnimationFrame(c.frame);
      c.marker.remove();
      cars.current.delete(id);
    });
  }, [map, members, me?.user_id]);

  useEffect(() => {
    const all = cars.current;
    return () => {
      all.forEach((c) => {
        if (c.frame) cancelAnimationFrame(c.frame);
        c.marker.remove();
      });
      all.clear();
    };
  }, []);

  const showDest = destination && !(routeDest && haversineMeters(routeDest.coordinates, destination.coordinates) < 50);
  return (
    <>
      {convoy && meetPoint && <PinMarker place={meetPoint} color="#a855f7" label={`Berkumpul · ${meetPoint.name}`} />}
      {convoy && showDest && <PinMarker place={destination} color="#0ea5e9" label={`Destinasi konvoi · ${destination.name}`} />}
    </>
  );
}

function PinMarker({ place, color, label }: { place: ConvoyPlace; color: string; label: string }) {
  const { map } = useMapContext();
  const { lat, lng } = place.coordinates;
  useEffect(() => {
    if (!map) return;
    const el = document.createElement('div');
    el.className = 'flex flex-col items-center';
    el.setAttribute('aria-label', label);
    el.innerHTML = `
      <div class="mb-0.5 max-w-[150px] truncate rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow" style="background:${color}">${esc(label)}</div>
      <svg width="30" height="38" viewBox="0 0 36 46" style="filter:drop-shadow(0 3px 4px rgb(0 0 0 / .35))">
        <path d="M18 45s15-15.2 15-27A15 15 0 0 0 3 18c0 11.8 15 27 15 27Z" fill="${color}" stroke="white" stroke-width="2.5"/>
        <path d="M13 11v14M13 11h10l-2 3.5 2 3.5H13" stroke="white" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
      </svg>`;
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, lat, lng, color, label]);
  return null;
}
