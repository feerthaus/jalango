import { useEffect, useMemo, useRef } from 'react';
import { useAccidents } from '@/contexts/AccidentsContext';
import { useRouting } from '@/contexts/RoutingContext';
import { hotspotPhrase, hotspotsOnRoute, type HotspotOnRoute } from '@/utils/accidentHotspots';
import { buildRouteIndex } from '@/utils/routeProgress';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from './useVoiceAlerts';

const SHOW_WITHIN_M = 1000;
const ANNOUNCE_AT_M = 500;

export interface AccidentAlert {
  hit: HotspotOnRoute;
  distance: number;
}

/** While navigating: the next accident black spot on the route, announced once at ~500 m. */
export function useAccidentAlerts(): AccidentAlert | null {
  const { status, selectedRoute, progress } = useRouting();
  const { hotspots } = useAccidents();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const announced = useRef(new Set<string>());
  const navigating = status === 'navigating';

  const onRoute = useMemo(() => (navigating && selectedRoute && hotspots.length ? hotspotsOnRoute(buildRouteIndex(selectedRoute), hotspots) : []), [navigating, selectedRoute, hotspots]);
  const along = progress?.along ?? 0;
  const next = useMemo(() => {
    const h = onRoute.find((x) => x.along > along - 30);
    return h && h.along - along <= SHOW_WITHIN_M ? { hit: h, distance: Math.max(0, h.along - along) } : null;
  }, [onRoute, along]);

  useEffect(() => {
    if (!next || next.distance > ANNOUNCE_AT_M) return;
    // records belong to one spot even if the spot's id shifts: key on its oldest record
    const key = next.hit.spot.records[next.hit.spot.records.length - 1].id;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    vibrate([250, 100, 250]);
    if (voiceOn) speak(hotspotPhrase(next.hit.spot, lang), lang);
  }, [next, voiceOn, lang]);

  useEffect(() => {
    if (!navigating) announced.current.clear();
  }, [navigating]);

  return next;
}
