import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReports } from '@/contexts/ReportsContext';
import { useRouting } from '@/contexts/RoutingContext';
import { reportMeta } from '@/lib/reportTypes';
import type { TrafficReport } from '@/types';
import { justPassed, reportsOnRoute, upcomingAlerts, type UpcomingAlert } from '@/utils/routeAlerts';
import { buildRouteIndex } from '@/utils/routeProgress';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from './useVoiceAlerts';
import { spokenDistance } from '@/utils/voiceInstructions';

const HORIZON_M = 2000;
const ANNOUNCE_AT_M = 800;
const ASK_FOR_MS = 15_000;

export interface RouteAlertsState {
  /** nearest community report ahead on the route */
  next: UpcomingAlert | null;
  /** how many reports are ahead within the horizon */
  aheadCount: number;
  /** a report just driven past that the driver can confirm or clear */
  ask: TrafficReport | null;
  dismissAsk: () => void;
}

/**
 * Waze-style hazard alerts while navigating:
 *  - shows the nearest report on the route ahead
 *  - vibrates + speaks once when it comes within ~800 m
 *  - right after passing it, asks "still there?" (signed-in, not own, not voted)
 */
export function useRouteAlerts(): RouteAlertsState {
  const { status, selectedRoute, progress } = useRouting();
  const { reports, myVotes } = useReports();
  const { user } = useAuth();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const announced = useRef(new Set<string>());
  const asked = useRef(new Set<string>());
  const [ask, setAsk] = useState<TrafficReport | null>(null);
  const navigating = status === 'navigating';

  // Project reports onto the route once per route/report change (not per GPS fix)
  const onRoute = useMemo(() => {
    if (!navigating || !selectedRoute || reports.length === 0) return [];
    return reportsOnRoute(buildRouteIndex(selectedRoute), reports);
  }, [navigating, selectedRoute, reports]);

  const along = progress?.along ?? 0;
  const ahead = useMemo(() => upcomingAlerts(onRoute, along, HORIZON_M), [onRoute, along]);
  const next = ahead[0] ?? null;

  // Announce once per report
  useEffect(() => {
    if (!next || next.distance > ANNOUNCE_AT_M || announced.current.has(next.report.id)) return;
    announced.current.add(next.report.id);
    vibrate([180, 80, 180]);
    if (voiceOn) {
      const meta = reportMeta(next.report.report_type);
      const d = spokenDistance(next.distance, lang);
      speak(lang === 'ms' ? `Awas, ${meta.labelMs.toLowerCase()} dilaporkan dalam ${d} di hadapan` : `${meta.label} reported ahead, in ${d}`, lang);
    }
  }, [next, voiceOn, lang]);

  // Ask about a report right after passing it
  useEffect(() => {
    if (!navigating || !user || ask) return;
    const candidate = justPassed(onRoute, along).find(
      (r) => !asked.current.has(r.report.id) && r.report.user_id !== user.id && !myVotes[r.report.id],
    );
    if (!candidate) return;
    asked.current.add(candidate.report.id);
    setAsk(candidate.report);
  }, [navigating, user, ask, onRoute, along, myVotes]);

  useEffect(() => {
    if (!ask) return;
    const id = setTimeout(() => setAsk(null), ASK_FOR_MS);
    return () => clearTimeout(id);
  }, [ask]);

  // Reset between trips
  useEffect(() => {
    if (navigating) return;
    announced.current.clear();
    asked.current.clear();
    setAsk(null);
  }, [navigating]);

  return { next, aheadCount: ahead.length, ask, dismissAsk: () => setAsk(null) };
}
