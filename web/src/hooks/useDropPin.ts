import type { LngLat, MapMouseEvent, MapTouchEvent } from 'mapbox-gl';
import { useEffect } from 'react';
import { useMapContext } from '@/contexts/MapContext';
import { reverseGeocode } from '@/services/geocodingService';
import type { Coordinates, Place } from '@/types';
import { formatCoordinates } from '@/utils/geo';
import { vibrate } from './useVoiceAlerts';

const HOLD_MS = 550;
const MOVE_TOLERANCE_PX = 10;

/** A place at exactly where the driver pressed (the address is filled in afterwards). */
export function pinPlace(at: Coordinates, nearby?: Place | null): Place {
  const label = nearby?.name ? `Berhampiran ${nearby.name}` : 'Pin di peta';
  return {
    id: `pin:${at.lat.toFixed(6)},${at.lng.toFixed(6)}`,
    name: label,
    address: nearby ? [nearby.name, nearby.address].filter(Boolean).join(', ') : formatCoordinates(at),
    coordinates: at, // keep the exact spot, not the geocoder's
    kind: 'address',
    source: 'mapbox',
  };
}

/**
 * Long-press (touch) or right-click (mouse) on the map drops a pin there, so
 * drivers can navigate to streets the search doesn't know.
 */
export function useDropPin(enabled: boolean) {
  const { map, selectPlace } = useMapContext();

  useEffect(() => {
    if (!map || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;
    let controller: AbortController | null = null;

    const drop = (lngLat: LngLat) => {
      const at = { lng: lngLat.lng, lat: lngLat.lat };
      vibrate(40);
      selectPlace(pinPlace(at));
      controller?.abort();
      controller = new AbortController();
      const c = controller;
      reverseGeocode(at, c.signal)
        .then((near) => !c.signal.aborted && near && selectPlace(pinPlace(at, near)))
        .catch(() => {});
    };
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
    };
    const onTouchStart = (e: MapTouchEvent) => {
      cancel();
      if (e.originalEvent.touches.length !== 1) return;
      start = { x: e.point.x, y: e.point.y };
      const lngLat = e.lngLat;
      timer = setTimeout(() => {
        timer = null;
        drop(lngLat);
      }, HOLD_MS);
    };
    const onTouchMove = (e: MapTouchEvent) => {
      if (!start) return;
      if (e.originalEvent.touches.length !== 1 || Math.hypot(e.point.x - start.x, e.point.y - start.y) > MOVE_TOLERANCE_PX) cancel();
    };
    const onContextMenu = (e: MapMouseEvent) => {
      e.preventDefault();
      drop(e.lngLat);
    };

    map.on('touchstart', onTouchStart);
    map.on('touchmove', onTouchMove);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('dragstart', cancel);
    map.on('zoomstart', cancel);
    map.on('contextmenu', onContextMenu);
    return () => {
      cancel();
      controller?.abort();
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancel);
      map.off('touchcancel', cancel);
      map.off('dragstart', cancel);
      map.off('zoomstart', cancel);
      map.off('contextmenu', onContextMenu);
    };
  }, [map, enabled, selectPlace]);
}
