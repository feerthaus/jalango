import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating, useRouting } from '@/contexts/RoutingContext';
import { useVehiclePose } from '@/hooks/useVehiclePose';
import { PITCH_2D_DRIVING, PITCH_3D } from '@/lib/map3d';
import { cameraZoom } from '@/utils/turnFocus';

/** Driving camera: tilted, heading-up, with the puck in the lower third. */
export function NavigationCamera() {
  const { map, following, setFollowing, mapMode } = useMapContext();
  const { fix } = useLocation();
  const pose = useVehiclePose();
  const navigating = useIsNavigating();
  const { selectedRoute, progress } = useRouting();
  // Closer in for a few seconds before a turn on an ordinary road
  const zoom = cameraZoom(fix?.speed, progress ? selectedRoute?.steps[progress.stepIndex + 1] : undefined, progress?.distanceToManeuver);
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
      zoom,
      padding: { top: Math.round(h * (short ? 0.3 : 0.4)), bottom: 0, left, right: 0 },
      duration: reduceMotion ? 0 : pose.duration || 600,
      easing: (t) => t,
    });
  }, [map, navigating, following, pose, mapMode]); // eslint-disable-line react-hooks/exhaustive-deps -- zoom rides along with the next pose

  return null;
}
