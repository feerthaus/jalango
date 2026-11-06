import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating } from '@/contexts/RoutingContext';
import { useVehiclePose } from '@/hooks/useVehiclePose';

/** Driving camera: tilted, heading-up, with the puck in the lower third. */
export function NavigationCamera() {
  const { map, following, setFollowing } = useMapContext();
  const { fix } = useLocation();
  const pose = useVehiclePose();
  const navigating = useIsNavigating();
  const wasNavigating = useRef(false);

  useEffect(() => {
    if (!map) return;
    if (navigating && !wasNavigating.current) setFollowing(true);
    if (!navigating && wasNavigating.current) {
      map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 800 });
    }
    wasNavigating.current = navigating;
  }, [map, navigating, setFollowing]);

  // Follow the same (snapped, interpolated) pose as the car, with a linear
  // ease of the same length, so camera and car glide together.
  useEffect(() => {
    if (!map || !navigating || !following || !pose) return;
    const h = map.getContainer().clientHeight;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: [pose.position.lng, pose.position.lat],
      bearing: pose.bearing,
      pitch: 50,
      zoom: (fix?.speed ?? 0) > 22 ? 15.5 : 16.5,
      padding: { top: Math.round(h * 0.4), bottom: 0, left: 0, right: 0 },
      duration: reduceMotion ? 0 : pose.duration || 600,
      easing: (t) => t,
    });
  }, [map, navigating, following, pose]);

  return null;
}
