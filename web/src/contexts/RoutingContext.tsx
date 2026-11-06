import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProbeConsent } from '@/hooks/useProbeConsent';
import { ProbeCollector } from '@/services/probeService';
import { fetchRoutes } from '@/services/routingService';
import { clearTrip, loadTrip, saveTrip } from '@/services/tripStore';
import type { Coordinates, Place, Route } from '@/types';
import { buildRouteIndex, computeProgress, type RouteIndex, type RouteProgress } from '@/utils/routeProgress';
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
  retry: () => void;
  selectRoute: (index: number) => void;
  setAvoidTolls: (on: boolean) => void;
  startNavigation: () => void;
  endNavigation: () => void;
  clearRoute: () => void;
}

const RoutingContext = createContext<RoutingValue | null>(null);

const OFF_ROUTE_METERS = 60;
const OFF_ROUTE_FIXES = 3;
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
  const [rerouting, setRerouting] = useState(false);
  const [requestId, setRequestId] = useState(0);

  const fixRef = useRef(fix);
  fixRef.current = fix;
  const originRef = useRef<Coordinates | null>(null);
  const navigatingRef = useRef(false);
  const indexRef = useRef<RouteIndex | null>(null);
  const segmentHint = useRef<number | undefined>(undefined);
  const offRouteCount = useRef(0);
  const lastReroute = useRef(0);
  const collector = useRef<ProbeCollector | null>(null);
  /** What to do once a restored trip's routes are loaded */
  const resumeRef = useRef<'navigate' | 'preview' | null>(null);
  const [resumedTo, setResumedTo] = useState<string | null>(null);

  const selectedRoute = routes[selectedIndex] ?? null;

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
      live: searchMode === 'live',
      avoidTolls,
      destinationName: destination.name,
      signal: controller.signal,
    })
      .then((res) => {
        setRoutes(res.routes);
        setSelectedIndex(0);
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
    setRequestId((n) => n + 1);
  }, [requestLocation]);

  const planRoute = useCallback(
    (place: Place) => {
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
    const p = computeProgress(selectedRoute, indexRef.current, fix.coordinates, segmentHint.current);
    segmentHint.current = p.segment;
    setProgress(p);

    if (p.arrived) {
      setStatus('arrived');
      return;
    }
    if (selectedRoute.source === 'demo') return; // straight line: no rerouting
    const tolerance = Math.max(OFF_ROUTE_METERS, fix.accuracy * 1.5);
    offRouteCount.current = p.offset > tolerance ? offRouteCount.current + 1 : 0;
    if (offRouteCount.current >= OFF_ROUTE_FIXES && Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS) {
      offRouteCount.current = 0;
      lastReroute.current = Date.now();
      request();
    }
  }, [fix, status, selectedRoute, request]);

  const stopCollector = () => {
    collector.current?.stop();
    collector.current = null;
  };

  const startNavigation = useCallback(() => {
    if (!selectedRoute || !destination) return;
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
    saveTrip({ destination, avoidTolls, navigating: status === 'navigating' || resumeRef.current === 'navigate' });
  }, [destination, status, avoidTolls]);

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
  }, []);

  const endNavigation = useCallback(() => {
    reset();
    setDestination(null);
  }, [reset]);

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
      retry: request,
      selectRoute: setSelectedIndex,
      setAvoidTolls,
      startNavigation,
      endNavigation,
      clearRoute,
    }),
    [status, destination, routes, selectedIndex, selectedRoute, mode, notice, error, avoidTolls, progress, rerouting, resumedTo, planRoute, request, setAvoidTolls, startNavigation, endNavigation, clearRoute],
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
