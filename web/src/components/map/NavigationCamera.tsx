import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating, useRouting } from '@/contexts/RoutingContext';

/** Driving camera: tilted, heading-up, with the puck in the lower third. */
export function NavigationCamera() {
  const { map, following, setFollowing } = useMapContext();
  const { fix } = useLocation();
  const { progress } = useRouting();
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

  useEffect(() => {
    if (!map || !navigating || !following || !fix) return;
    const moving = (fix.speed ?? 0) > 1.5 && fix.heading !== null;
    const bearing = moving ? fix.heading! : (progress?.bearing ?? map.getBearing());
    const h = map.getContainer().clientHeight;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      center: [fix.coordinates.lng, fix.coordinates.lat],
      bearing,
      pitch: 50,
      zoom: (fix.speed ?? 0) > 22 ? 15.5 : 16.5,
      padding: { top: Math.round(h * 0.4), bottom: 0, left: 0, right: 0 },
      duration: reduceMotion ? 0 : 900,
    });
  }, [map, navigating, following, fix, progress?.bearing]);

  return null;
}
