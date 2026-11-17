import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating } from '@/contexts/RoutingContext';
import { useVehiclePose } from '@/hooks/useVehiclePose';
import { PITCH_2D_DRIVING, PITCH_3D } from '@/lib/map3d';

/** Driving camera: tilted, heading-up, with the puck in the lower third. */
export function NavigationCamera() {
  const { map, following, setFollowing, mapMode } = useMapContext();
  const { fix } = useLocation();
  const pose = useVehiclePose();
  const navigating = useIsNavigating();
  const wasNavigating = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (navigating && !wasNavigating.current) setFollowing(true);
    if (!navigating && wasNavigating.current) {
      // Trip over: 2D goes back flat and north-up; 3D stays tilted and keeps its heading
      map.easeTo({ pitch: mapMode === '3d' ? PITCH_3D : 0, bearing: mapMode === '3d' ? map.getBearing() : 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 800 });
    }
    wasNavigating.current = navigating;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, navigating, setFollowing]);

  // Follow the same (snapped, interpolated) pose as the car, with a linear
  // ease of the same length, so camera and car glide together.
  useEffect(() => {
    if (!map || !navigating || !following || !pose) return;
    const { clientHeight: h, clientWidth: w } = map.getContainer();
    // Wide screens (tablet, desktop, phone sideways) keep the driving panel on the left:
    // centre the car in the map that's left visible
    const left = w >= 768 || (w > h && h <= 500) ? Math.min(420, Math.round(w * 0.42)) : 0;
    const short = w > h && h <= 500;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: [pose.position.lng, pose.position.lat],
      bearing: pose.bearing,
      pitch: mapMode === '3d' ? PITCH_3D : PITCH_2D_DRIVING,
      zoom: (fix?.speed ?? 0) > 22 ? 15.5 : 16.5,
      padding: { top: Math.round(h * (short ? 0.3 : 0.4)), bottom: 0, left, right: 0 },
      duration: reduceMotion ? 0 : pose.duration || 600,
      easing: (t) => t,
    });
  }, [map, navigating, following, pose, mapMode]);

  return null;
}
