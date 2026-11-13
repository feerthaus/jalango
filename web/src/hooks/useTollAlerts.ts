import { useEffect, useMemo, useRef } from 'react';
import { useRouting } from '@/contexts/RoutingContext';
import { useTollPayment } from '@/lib/tollPayment';
import { buildRouteIndex } from '@/utils/routeProgress';
import { tollPhrase, tollsOnRoute, type TollOnRoute } from '@/utils/tollAlerts';
import { spokenDistance } from '@/utils/voiceInstructions';
import { speak, useVoiceAlerts, useVoiceLang } from './useVoiceAlerts';

const SHOW_WITHIN_M = 2000;
const ANNOUNCE_AT_M = 1000;

export interface TollAlert {
  hit: TollOnRoute;
  distance: number;
}

/** While navigating: the next toll plaza or gantry on the route, announced once at ~1 km. */
export function useTollAlerts(): TollAlert | null {
  const { status, selectedRoute, progress } = useRouting();
  const [pay] = useTollPayment();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const announced = useRef(new Set<string>());
  const navigating = status === 'navigating';

  const onRoute = useMemo(() => (navigating && selectedRoute?.tollPoints?.length ? tollsOnRoute(buildRouteIndex(selectedRoute), selectedRoute.tollPoints) : []), [navigating, selectedRoute]);
  const along = progress?.along ?? 0;
  const next = useMemo(() => {
    const h = onRoute.find((x) => x.along > along - 20);
    return h && h.along - along <= SHOW_WITHIN_M ? { hit: h, distance: Math.max(0, h.along - along) } : null;
  }, [onRoute, along]);

  useEffect(() => {
    if (!next || next.distance > ANNOUNCE_AT_M) return;
    const key = `${next.hit.toll.location.lat.toFixed(4)},${next.hit.toll.location.lng.toFixed(4)}`;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    if (voiceOn) speak(tollPhrase(next.hit.toll, pay, spokenDistance(next.distance, lang), lang), lang);
  }, [next, voiceOn, lang, pay]);

  useEffect(() => {
    if (!navigating) announced.current.clear();
  }, [navigating]);

  return next;
}
