import { useEffect, useRef } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useRouting } from '@/contexts/RoutingContext';
import { maneuverPhrase, PHRASES, stageThresholds, type VoiceStage } from '@/utils/voiceInstructions';
import { speak, useVoiceAlerts, useVoiceLang } from './useVoiceAlerts';

/**
 * Spoken turn-by-turn guidance. Each upcoming maneuver is announced up to
 * three times — far, near and "now" — once per stage; also on start,
 * rerouting and arrival. Uses the device's built-in voices (free, offline).
 */
export function useVoiceGuidance() {
  const { status, selectedRoute, progress, rerouting } = useRouting();
  const { fix } = useLocation();
  const [on] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const spoken = useRef(new Set<string>());
  const routeId = useRef<string | null>(null);
  const navigating = status === 'navigating';

  // New trip / new route after reroute: reset what has been said
  useEffect(() => {
    if (!navigating || !selectedRoute) return;
    const id = `${selectedRoute.id}:${selectedRoute.geometry.coordinates.length}:${selectedRoute.distanceMeters}`;
    if (routeId.current === id) return;
    const first = routeId.current === null;
    routeId.current = id;
    spoken.current.clear();
    if (on && first) speak(PHRASES.start[lang], lang);
  }, [navigating, selectedRoute, on, lang]);

  useEffect(() => {
    if (navigating && rerouting && on) speak(PHRASES.reroute[lang], lang, { interrupt: true });
  }, [navigating, rerouting, on, lang]);

  useEffect(() => {
    if (status === 'arrived' && on) speak(PHRASES.arrived[lang], lang, { interrupt: true });
    if (status === 'idle') routeId.current = null;
  }, [status, on, lang]);

  useEffect(() => {
    if (!navigating || !on || !selectedRoute || !progress) return;
    const nextIndex = progress.stepIndex + 1;
    const next = selectedRoute.steps[nextIndex];
    if (!next) return;
    const d = progress.distanceToManeuver;
    const t = stageThresholds(fix?.speed ?? null);
    // the step must be long enough for a stage to make sense (skip "far" on short steps)
    const stage: VoiceStage | null = d <= t.now ? 'now' : d <= t.near ? 'near' : d <= t.far && d > t.near * 1.6 ? 'far' : null;
    if (!stage) return;
    const key = `${nextIndex}:${stage}`;
    if (spoken.current.has(key)) return;
    // once "near" is said, don't go back to "far" (e.g. after GPS jitter)
    if (stage === 'far' && spoken.current.has(`${nextIndex}:near`)) return;
    spoken.current.add(key);
    if (next.maneuver.type === 'arrive' && stage === 'now') return; // arrival phrase handles it
    speak(maneuverPhrase(next, d, lang, stage), lang, { interrupt: stage === 'now' });
  }, [navigating, on, lang, selectedRoute, progress, fix?.speed]);
}
