import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProbeConsent } from '@/hooks/useProbeConsent';
import { ProbeCollector } from '@/services/probeService';
import { fetchRoutes } from '@/services/routingService';
import { clearActiveTrace, clearTrip, loadActiveTrace, loadTrip, loadTripRoute, saveActiveTrace, saveTrip, saveTripRoute } from '@/services/tripStore';
import type { Shortcut } from '@/types';
import { haversineMeters } from '@/utils/geo';
import { speak, useVoiceAlerts, useVoiceLang } from '@/hooks/useVoiceAlerts';
import { pathLength, roundPath, sampleWaypoints, simplify } from '@/utils/trace';
import { useTrips } from './TripsContext';
import type { Coordinates, Place, Route } from '@/types';
import { buildRouteIndex, computeProgress, pickRerouteIndex, projectOnRoute, type RouteIndex, type RouteProgress } from '@/utils/routeProgress';

const computeAlongSafe = (index: RouteIndex, p: Coordinates, hint?: number) => projectOnRoute(index, p, hint).along;
import { useLocation } from './LocationContext';
import { useServiceStatus } from './ServiceStatusContext';

export type RoutingStatus = 'idle' | 'needs-location' | 'loading' | 'ready' | 'error' | 'navigating' | 'arrived';

interface RoutingValue {
  status: RoutingStatus;
  destination: Place | null;
  routes: Route[];
  selectedIndex: number;
  selectedRoute: Route | null;
  mode: 'live' | 'demo' | null;
  notice: string | null;
  error: string | null;
  avoidTolls: boolean;
  progress: RouteProgress | null;
  rerouting: boolean;
  /** Destination name when a trip was restored after the app reopened */
  resumedTo: string | null;
  dismissResumed: () => void;
  planRoute: (destination: Place) => void;
  /** Plan a route to `place` and start turn-by-turn as soon as it's ready (e.g. next itinerary stop) */
  navigateTo: (place: Place) => void;
  retry: () => void;
  selectRoute: (index: number) => void;
  setAvoidTolls: (on: boolean) => void;
  startNavigation: () => void;
  endNavigation: () => void;
  clearRoute: () => void;
  /** Community shortcut the current route goes through */
  shortcut: Shortcut | null;
  shortcutTitle: string | null;
  applyShortcut: (s: Shortcut, destination?: Place | null) => void;
  clearShortcut: () => void;
  /** A stop on the way (e.g. lunch); the route goes through it, then on to the destination */
  stop: Place | null;
  addStop: (place: Place) => void;
  clearStop: () => void;
  /** Trip just recorded on arrival (for the rating prompt) */
  finishedTripId: string | null;
}

const RoutingContext = createContext<RoutingValue | null>(null);

const OFF_ROUTE_METERS = 60;
const OFF_ROUTE_FIXES = 3;
const DEMO_RETRY_MS = 20_000;
const POOR_ACCURACY_M = 75;
/** a fix after this long without GPS may be a jump, not a real position change */
const GPS_GAP_MS = 15_000;
const REROUTE_COOLDOWN_MS = 15_000;

export function RoutingProvider({ children }: { children: ReactNode }) {
  const { fix, request: requestLocation } = useLocation();
  const { searchMode } = useServiceStatus();
  const [consent] = useProbeConsent();

  const [status, setStatus] = useState<RoutingStatus>('idle');
  const [destination, setDestination] = useState<Place | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avoidTolls, setAvoidTollsState] = useState(false);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const progressRef = useRef<RouteProgress | null>(null);
  progressRef.current = progress;
  const [rerouting, setRerouting] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const fixRef = useRef(fix);
  fixRef.current = fix;
  const originRef = useRef<Coordinates | null>(null);
  /** direction of travel when the route was requested (null = unknown / standing still) */
  const headingRef = useRef<number | null>(null);
  const navigatingRef = useRef(false);
  const indexRef = useRef<RouteIndex | null>(null);
  const segmentHint = useRef<number | undefined>(undefined);
  const offRouteCount = useRef(0);
  const lastFixAt = useRef<number | null>(null);
  const lastReroute = useRef(0);
  const collector = useRef<ProbeCollector | null>(null);
  /** What to do once a restored trip's routes are loaded */
  const resumeRef = useRef<'navigate' | 'preview' | null>(null);
  const [resumedTo, setResumedTo] = useState<string | null>(null);
  const { recordTrip } = useTrips();
  const [shortcut, setShortcut] = useState<Shortcut | null>(null);
  const [shortcutTitle, setShortcutTitle] = useState<string | null>(null);
  const [stop, setStop] = useState<Place | null>(null);
  const [voiceOn] = useVoiceAlerts();
  const [voiceLang] = useVoiceLang();
  const viaRef = useRef<Coordinates[]>([]);
  const traceRef = useRef<[number, number][]>([]);
  const startedAtRef = useRef<string | null>(null);
  const [finishedTripId, setFinishedTripId] = useState<string | null>(null);

  const selectedRoute = routes[selectedIndex] ?? null;
  const selectedRouteRef = useRef<Route | null>(null);
  selectedRouteRef.current = selectedRoute;

  // Fetch routes whenever a request is made (plan, retry, toggle tolls, reroute)
  useEffect(() => {
    if (!destination || requestId === 0) return;
    const origin = originRef.current;
    if (!origin) return;
    const controller = new AbortController();
    const isReroute = navigatingRef.current;
    if (isReroute) setRerouting(true);
    else setStatus('loading');
    setError(null);

    fetchRoutes(origin, destination.coordinates, {
      // Still checking the server (e.g. right after the app reopens)? Try live anyway —
      // fetchRoutes falls back to the straight-line preview if it really is down.
      live: searchMode !== 'demo',
      avoidTolls,
      destinationName: destination.name,
      via: viaRef.current,
      heading: headingRef.current,
      signal: controller.signal,
    })
      .then((res) => {
        // A reroute that hit a network blip must not swap a real road route for a straight line
        if (isReroute && res.mode === 'demo' && selectedRouteRef.current && selectedRouteRef.current.source !== 'demo') return;
        // Reopened with no signal: carry on with the road route we were following, if we're still on it
        if (!isReroute && res.mode === 'demo' && resumeRef.current === 'navigate') {
          const saved = loadTripRoute(destination.id);
          if (saved && projectOnRoute(buildRouteIndex(saved), origin).offset < 500) {
            res = { routes: [saved], mode: 'live', notice: 'Tiada isyarat: meneruskan laluan yang tersimpan.' };
          }
        }
        setRoutes(res.routes);
        // After a reroute, don't follow a route that starts with a U-turn if an alternative doesn't
        setSelectedIndex(isReroute ? pickRerouteIndex(res.routes) : 0);
        setMode(res.mode);
        setNotice(res.notice ?? null);
        segmentHint.current = undefined;
        if (!isReroute) setStatus('ready');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Could not calculate a route');
        if (!isReroute) setStatus('error');
      })
      .finally(() => !controller.signal.aborted && setRerouting(false));

    return () => controller.abort();
    // searchMode is read at request time; changing it alone shouldn't refetch
  }, [requestId]);

  const request = useCallback(() => {
    const here = fixRef.current?.coordinates;
    if (!here) {
      setStatus('needs-location');
      requestLocation();
      return;
    }
    originRef.current = here;
    // GPS heading is only trustworthy while moving; when stopped mid-trip use the route's direction
    const f = fixRef.current;
    headingRef.current =
      f && f.heading !== null && (f.speed ?? 0) >= 3 ? f.heading : navigatingRef.current && progressRef.current ? progressRef.current.bearing : null;
    // When rerouting mid-trip, skip shortcut points we've already driven past
    if (navigatingRef.current && viaRef.current.length && indexRef.current && segmentHint.current !== undefined) {
      const index = indexRef.current;
      const along = computeAlongSafe(index, here, segmentHint.current);
      viaRef.current = viaRef.current.filter((v) => {
        const a = computeAlongSafe(index, v);
        return a > along + 50 && haversineMeters(v, here) > 80;
      });
    }
    setRequestId((n) => n + 1);
  }, [requestLocation]);

  const planRoute = useCallback(
    (place: Place) => {
      viaRef.current = [];
      setShortcut(null);
      setShortcutTitle(null);
      setStop(null);
      setDestination(place);
      setRoutes([]);
      setProgress(null);
      // defer so the destination state is committed before the fetch effect runs
      queueMicrotask(request);
    },
    [request],
  );

  // A GPS fix arriving while we wait for one completes the pending request
  useEffect(() => {
    if (status === 'needs-location' && fix && destination) request();
  }, [status, fix, destination, request]);

  const setAvoidTolls = useCallback(
    (on: boolean) => {
      setAvoidTollsState(on);
      if (destination && status !== 'navigating') queueMicrotask(request);
    },
    [destination, status, request],
  );

  // Rebuild the spatial index for the active route
  useEffect(() => {
    indexRef.current = selectedRoute ? buildRouteIndex(selectedRoute) : null;
    segmentHint.current = undefined;
    offRouteCount.current = 0;
  }, [selectedRoute]);

  // Live progress, arrival and off-route detection while navigating
  useEffect(() => {
    if (status !== 'navigating' || !fix || !selectedRoute || !indexRef.current) return;
    collector.current?.add(fix);
    recordPoint(fix.coordinates, fix.accuracy);
    const p = computeProgress(selectedRoute, indexRef.current, fix.coordinates, segmentHint.current);
    segmentHint.current = p.segment;
    setProgress(p);

    if (p.arrived) {
      finishTrip(true);
      setStatus('arrived');
      return;
    }
    if (selectedRoute.source === 'demo') return; // straight line: no rerouting
    // Weak GPS (tunnels, flyovers, tall buildings) jumps around: don't let those fixes trigger a reroute
    const gap = lastFixAt.current ? fix.timestamp - lastFixAt.current : 0;
    lastFixAt.current = fix.timestamp;
    if (fix.accuracy > POOR_ACCURACY_M || gap > GPS_GAP_MS) {
      offRouteCount.current = 0;
      return;
    }
    const tolerance = Math.max(OFF_ROUTE_METERS, fix.accuracy * 1.5);
    offRouteCount.current = p.offset > tolerance ? offRouteCount.current + 1 : 0;
    if (offRouteCount.current >= OFF_ROUTE_FIXES && Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS) {
      offRouteCount.current = 0;
      lastReroute.current = Date.now();
      request();
    }
  }, [fix, status, selectedRoute, request]);

  // Keep the road route on the phone so a reopened app can continue without signal
  useEffect(() => {
    if (status === 'navigating' && destination && selectedRoute && selectedRoute.source !== 'demo') saveTripRoute(destination.id, selectedRoute);
  }, [status, destination, selectedRoute]);

  // Navigating on a straight-line fallback: keep trying to get the real road route
  useEffect(() => {
    if (status !== 'navigating' || selectedRoute?.source !== 'demo' || searchMode === 'demo') return;
    const id = setInterval(() => request(), DEMO_RETRY_MS);
    return () => clearInterval(id);
  }, [status, selectedRoute, searchMode, request]);

  const stopCollector = () => {
    collector.current?.stop();
    collector.current = null;
  };

  const recordPoint = (c: Coordinates, accuracy: number) => {
    if (accuracy > 60) return;
    const t = traceRef.current;
    const last = t[t.length - 1];
    if (last && haversineMeters({ lng: last[0], lat: last[1] }, c) < 20) return;
    if (t.length >= 4000) return;
    t.push([c.lng, c.lat]);
    if (startedAtRef.current && t.length % 10 === 0) saveActiveTrace({ startedAt: startedAtRef.current, trace: t });
  };

  /** Save the trip to history. Ended early trips under 300 m aren't worth keeping. */
  const finishTrip = (arrived: boolean) => {
    const startedAt = startedAtRef.current;
    const dest = destination;
    startedAtRef.current = null;
    clearActiveTrace();
    if (!startedAt || !dest) return;
    const trace = roundPath(simplify(traceRef.current, 5));
    traceRef.current = [];
    const driven = pathLength(trace);
    if (!arrived && driven < 300) return;
    const endedAt = new Date().toISOString();
    const id = recordTrip({
      destination: { name: dest.name, address: dest.address, coordinates: dest.coordinates, placeId: dest.id },
      startedAt,
      endedAt,
      distanceMeters: driven > 0 ? driven : (selectedRoute?.distanceMeters ?? 0),
      durationSeconds: Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000),
      arrived,
      routeSummary: shortcutTitle ? `via shortcut: ${shortcutTitle}` : selectedRoute?.summary || undefined,
      trace: trace.length >= 2 ? trace : undefined,
    });
    if (arrived) setFinishedTripId(id);
  };

  const startNavigation = useCallback(() => {
    if (!selectedRoute || !destination) return;
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
      traceRef.current = [];
      if (originRef.current) recordPoint(originRef.current, 0);
    }
    navigatingRef.current = true;
    setStatus('navigating');
    // keep only the chosen route
    setRoutes([selectedRoute]);
    setSelectedIndex(0);
    if (consent === 'granted' && originRef.current) {
      collector.current = new ProbeCollector(originRef.current, destination.coordinates);
    }
  }, [selectedRoute, destination, consent]);

  // Restore the last trip when the app reopens (route is recalculated from here)
  useEffect(() => {
    const trip = loadTrip();
    if (!trip) return;
    resumeRef.current = trip.navigating ? 'navigate' : 'preview';
    if (trip.navigating) {
      const active = loadActiveTrace();
      if (active) {
        startedAtRef.current = active.startedAt;
        traceRef.current = active.trace;
      }
    }
    if (trip.via?.length) {
      viaRef.current = trip.via;
      setShortcutTitle(trip.shortcutTitle ?? 'Community shortcut');
    }
    if (trip.stop) {
      setStop(trip.stop);
      viaRef.current = [trip.stop.coordinates];
    }
    setDestination(trip.destination);
    setAvoidTollsState(trip.avoidTolls);
    setResumedTo(trip.destination.name);
    queueMicrotask(request);
    // run once on mount
  }, []);

  // Resume turn-by-turn automatically once the fresh route is ready
  useEffect(() => {
    if (status !== 'ready' || !resumeRef.current) return;
    const mode = resumeRef.current;
    resumeRef.current = null;
    if (mode === 'navigate') startNavigation();
  }, [status, startNavigation]);

  // Keep the saved trip in sync (skip the initial render, before a restore happens)
  const persistReady = useRef(false);
  useEffect(() => {
    if (!persistReady.current) {
      persistReady.current = true;
      return;
    }
    if (status === 'idle' && resumeRef.current) return; // a restore is about to start
    if (!destination || status === 'idle' || status === 'arrived') {
      clearTrip();
      return;
    }
    saveTrip({
      destination,
      avoidTolls,
      navigating: status === 'navigating' || resumeRef.current === 'navigate',
      via: viaRef.current.length ? viaRef.current : undefined,
      shortcutTitle: shortcutTitle ?? undefined,
      stop: stop ?? undefined,
    });
  }, [destination, status, avoidTolls, shortcutTitle, stop]);

  useEffect(() => {
    if (!resumedTo) return;
    const id = setTimeout(() => setResumedTo(null), 8000);
    return () => clearTimeout(id);
  }, [resumedTo]);

  // Respect consent being withdrawn mid-trip
  useEffect(() => {
    if (consent !== 'granted') stopCollector();
  }, [consent]);

  const reset = useCallback(() => {
    navigatingRef.current = false;
    stopCollector();
    setStatus('idle');
    setRoutes([]);
    setProgress(null);
    setError(null);
    setNotice(null);
    setMode(null);
    setRerouting(false);
    resumeRef.current = null;
    setResumedTo(null);
    viaRef.current = [];
    setShortcut(null);
    setShortcutTitle(null);
    setStop(null);
    traceRef.current = [];
    startedAtRef.current = null;
    clearActiveTrace();
    setFinishedTripId(null);
  }, []);

  const statusRef = useRef(status);
  statusRef.current = status;
  const finishTripRef = useRef(finishTrip);
  finishTripRef.current = finishTrip;

  const endNavigation = useCallback(() => {
    // Ending mid-trip still records it in the history (arrival already did)
    if (statusRef.current === 'navigating') finishTripRef.current(false);
    reset();
    setDestination(null);
  }, [reset]);

  const navigateTo = useCallback(
    (place: Place) => {
      reset(); // the previous leg was already recorded on arrival
      setDestination(place);
      resumeRef.current = 'navigate'; // auto-start once the route is ready
      queueMicrotask(request);
    },
    [reset, request],
  );

  const applyShortcut = useCallback(
    (s: Shortcut, dest?: Place | null) => {
      const end = s.path[s.path.length - 1];
      const target: Place = dest ?? {
        id: `shortcut-end:${s.id}`,
        name: `End of “${s.title}”`,
        address: s.avoids ? `Shortcut · avoids ${s.avoids}` : 'Community shortcut',
        coordinates: { lng: end[0], lat: end[1] },
        kind: 'other',
        source: 'mapbox',
      };
      viaRef.current = sampleWaypoints(s.path, 12);
      setShortcut(s);
      setShortcutTitle(s.title);
      setDestination(target);
      setRoutes([]);
      setProgress(null);
      queueMicrotask(request);
    },
    [request],
  );

  const clearShortcut = useCallback(() => {
    viaRef.current = [];
    setShortcut(null);
    setShortcutTitle(null);
    queueMicrotask(request);
  }, [request]);

  const addStop = useCallback(
    (place: Place) => {
      // A stop replaces any shortcut: route here → stop → destination
      viaRef.current = [place.coordinates];
      setShortcut(null);
      setShortcutTitle(null);
      setStop(place);
      lastReroute.current = Date.now();
      queueMicrotask(request);
    },
    [request],
  );

  const clearStop = useCallback(() => {
    viaRef.current = [];
    setStop(null);
    queueMicrotask(request);
  }, [request]);

  // Reached the stop: drop it (the current route already continues to the destination)
  useEffect(() => {
    if (!stop || !fix || status !== 'navigating') return;
    if (haversineMeters(fix.coordinates, stop.coordinates) > 120) return;
    viaRef.current = [];
    setStop(null);
    if (voiceOn) speak(voiceLang === 'ms' ? `Anda telah sampai di ${stop.name}.` : `You have reached ${stop.name}.`, voiceLang);
  }, [fix, stop, status, voiceOn, voiceLang]);

  const clearRoute = useCallback(() => {
    reset();
    setDestination(null);
  }, [reset]);

  useEffect(() => () => stopCollector(), []);

  const value = useMemo<RoutingValue>(
    () => ({
      status,
      destination,
      routes,
      selectedIndex,
      selectedRoute,
      mode,
      notice,
      error,
      avoidTolls,
      progress,
      rerouting,
      resumedTo,
      dismissResumed: () => setResumedTo(null),
      planRoute,
      navigateTo,
      retry: request,
      selectRoute: setSelectedIndex,
      setAvoidTolls,
      startNavigation,
      endNavigation,
      clearRoute,
      shortcut,
      shortcutTitle,
      stop,
      addStop,
      clearStop,
      applyShortcut,
      clearShortcut,
      finishedTripId,
    }),
    [status, destination, routes, selectedIndex, selectedRoute, mode, notice, error, avoidTolls, progress, rerouting, resumedTo, planRoute, navigateTo, request, setAvoidTolls, startNavigation, endNavigation, clearRoute, shortcut, shortcutTitle, applyShortcut, clearShortcut, stop, addStop, clearStop, finishedTripId],
  );

  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

export function useRouting(): RoutingValue {
  const ctx = useContext(RoutingContext);
  if (!ctx) throw new Error('useRouting must be used within RoutingProvider');
  return ctx;
}

/** True while the user is in turn-by-turn mode (incl. the arrival screen). */
export function useIsNavigating(): boolean {
  const { status } = useRouting();
  return status === 'navigating' || status === 'arrived';
}
