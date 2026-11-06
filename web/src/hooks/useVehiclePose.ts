import { useMemo, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import type { Coordinates } from '@/types';
import { buildRouteIndex, sliceRoute } from '@/utils/routeProgress';
import { stepDuration } from '@/utils/motion';

export interface VehiclePose {
  position: Coordinates;
  /** degrees from north the car is facing */
  bearing: number;
  /** how long to animate from the previous pose (ms) */
  duration: number;
  key: number;
}

const SNAP_METERS = 25;

/**
 * Where to draw the car: the GPS fix, snapped onto the route while
 * navigating (so it follows the road instead of GPS jitter), facing the
 * direction of travel. Shared by the marker and the driving camera so both
 * move in step.
 */
export function useVehiclePose(): VehiclePose | null {
  const { fix } = useLocation();
  const { status, selectedRoute, progress } = useRouting();
  const navigating = status === 'navigating';
  const index = useMemo(() => (navigating && selectedRoute && selectedRoute.source !== 'demo' ? buildRouteIndex(selectedRoute) : null), [navigating, selectedRoute]);
  const lastBearing = useRef(0);
  const lastTs = useRef<number | null>(null);

  return useMemo(() => {
    if (!fix) return null;
    let position = fix.coordinates;
    let bearing: number | null = null;

    if (index && progress && progress.offset <= Math.max(SNAP_METERS, fix.accuracy)) {
      const driven = sliceRoute(index, progress.along);
      const p = driven[driven.length - 1];
      if (p) position = { lng: p[0], lat: p[1] };
      bearing = progress.bearing;
    }
    const moving = (fix.speed ?? 0) > 1.5 && fix.heading !== null;
    if (bearing === null && moving) bearing = fix.heading;
    if (bearing === null) bearing = lastBearing.current;
    lastBearing.current = bearing;

    const duration = stepDuration(lastTs.current, fix.timestamp);
    lastTs.current = fix.timestamp;
    return { position, bearing, duration, key: fix.timestamp };
    // progress changes together with fix while navigating
  }, [fix, index, progress?.along, progress?.bearing, progress?.offset]);
}
