import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import { createShare, fetchMyActiveShares, pushPosition, stopShare, type DriverInfo, type LiveShare } from '@/services/liveShareService';
import { useItinerary } from './ItineraryContext';
import { haversineMeters } from '@/utils/geo';
import { delaySeconds, honestEta, nextSlowState, NOT_SLOW, publishedSlowSince, type LiveEta, type SlowState } from '@/utils/liveTraffic';
import { fetchRoutes } from '@/services/routingService';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { useRouting } from './RoutingContext';

interface LiveShareValue {
  available: boolean;
  shares: LiveShare[];
  start: (opts: { displayName: string; minutes: number; untilArrival: boolean; driver?: DriverInfo | null }) => Promise<LiveShare>;
  stop: (id: string) => Promise<void>;
  stopAll: () => Promise<void>;
}

const LiveShareContext = createContext<LiveShareValue | null>(null);
const UNTIL_ARRIVAL_KEY = 'jalango:share-until-arrival';
const MIN_INTERVAL_MS = 5_000;
const HEARTBEAT_MS = 20_000;
const MIN_MOVE_M = 15;
/** While sharing a trip, check live traffic to the destination this often. */
const TRAFFIC_REFRESH_MS = 5 * 60_000;

function readUntilArrival(): string[] {
  try {
    return JSON.parse(localStorage.getItem(UNTIL_ARRIVAL_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * The signed-in user's active live-location shares, and the publisher that
 * keeps their latest position up to date (only while sharing, never history).
 */
export function LiveShareProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { fix } = useLocation();
  const { status, destination, progress, avoidTolls } = useRouting();
  const itinerary = useItinerary();
  // Driver mode: the stop being driven to (or the next unvisited one) and how many are left
  const nextStopIdx = itinerary.activeIndex !== -1 ? itinerary.activeIndex : itinerary.nextIndex;
  const nextStopName = nextStopIdx !== -1 ? itinerary.stops[nextStopIdx].place.name : null;
  const stopsLeft = itinerary.stops.filter((s) => !s.done).length;
  const nextStopKey = nextStopName ? `${nextStopName}|${stopsLeft}` : '';
  const lastStopKey = useRef<string | null>(null);
  const [shares, setShares] = useState<LiveShare[]>([]);
  const last = useRef<{ t: number; lat: number; lng: number } | null>(null);
  const available = features.supabase && Boolean(user);
  const navigating = status === 'navigating';

  // Traffic for the people watching: "in traffic since" and how late we'll be
  const slow = useRef<SlowState>(NOT_SLOW);
  const baselineEta = useRef<number | null>(null);
  const liveEta = useRef<LiveEta | null>(null);
  const lastSlowKey = useRef<string>('');
  const destKey = destination ? `${destination.coordinates.lat},${destination.coordinates.lng}` : '';
  useEffect(() => {
    // new trip (or trip over): start over
    slow.current = NOT_SLOW;
    baselineEta.current = null;
    liveEta.current = null;
  }, [destKey, navigating]);

  // Every 5 minutes while a shared trip is under way: ask for the route again with live traffic
  const sharing = shares.length > 0;
  const fixRef = useRef(fix);
  fixRef.current = fix;
  useEffect(() => {
    if (!sharing || !navigating || !destination) return;
    let alive = true;
    const check = () => {
      const f = fixRef.current;
      if (!f) return;
      fetchRoutes(f.coordinates, destination.coordinates, { live: true, avoidTolls, destinationName: destination.name, heading: f.heading })
        .then(({ routes, mode }) => {
          const r = routes[0];
          if (alive && r && mode === 'live') liveEta.current = { at: Date.now(), seconds: r.durationSeconds, meters: r.distanceMeters };
        })
        .catch(() => undefined);
    };
    const first = setTimeout(check, 60_000); // the planned route is fresh at the start
    const id = setInterval(check, TRAFFIC_REFRESH_MS);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, navigating, destKey, avoidTolls]);

  useEffect(() => {
    if (!available) {
      setShares([]);
      return;
    }
    fetchMyActiveShares().then(setShares).catch(() => {});
  }, [available]);

  // Drop expired shares locally
  useEffect(() => {
    if (shares.length === 0) return;
    const id = setInterval(() => setShares((s) => s.filter((x) => Date.parse(x.expires_at) > Date.now())), 30_000);
    return () => clearInterval(id);
  }, [shares.length]);

  const stop = useCallback(async (id: string) => {
    await stopShare(id);
    setShares((s) => s.filter((x) => x.id !== id));
    try {
      localStorage.setItem(UNTIL_ARRIVAL_KEY, JSON.stringify(readUntilArrival().filter((x) => x !== id)));
    } catch {
      /* ignore */
    }
  }, []);

  const stopAll = useCallback(async () => {
    await Promise.all(shares.map((s) => stop(s.id)));
  }, [shares, stop]);

  const start = useCallback(
    async (opts: { displayName: string; minutes: number; untilArrival: boolean; driver?: DriverInfo | null }) => {
      if (!user) throw new Error('Sign in to share your live location.');
      const share = await createShare({
        userId: user.id,
        displayName: opts.displayName,
        minutes: opts.minutes,
        destination: destination && status !== 'idle' ? { name: destination.name, coordinates: destination.coordinates } : null,
        driver: opts.driver ?? null,
      });
      setShares((s) => [share, ...s]);
      if (opts.untilArrival) {
        try {
          localStorage.setItem(UNTIL_ARRIVAL_KEY, JSON.stringify([...readUntilArrival(), share.id]));
        } catch {
          /* ignore */
        }
      }
      last.current = null; // publish the first position right away
      lastStopKey.current = null;
      return share;
    },
    [user, destination, status],
  );

  // Publish position (throttled) while any share is active
  useEffect(() => {
    if (!fix || shares.length === 0) return;
    const now = Date.now();
    const prev = last.current;
    const moved = prev ? haversineMeters({ lat: prev.lat, lng: prev.lng }, fix.coordinates) : Infinity;
    // Only driver-mode links show the itinerary's next stop; personal links never do
    const driverShare = shares.some((s) => s.driver_plate);
    const stopChanged = driverShare && lastStopKey.current !== nextStopKey;
    // Traffic: update the slow state on every fix, publish when it changes
    slow.current = navigating ? nextSlowState(slow.current, fix.speed !== null ? fix.speed * 3.6 : moved < 5 ? 0 : 99, now) : NOT_SLOW;
    const slowSince = navigating ? publishedSlowSince(slow.current, now, progress?.remainingMeters ?? null) : null;
    const eta = navigating && progress ? honestEta(now, progress.remainingSeconds, progress.remainingMeters, liveEta.current) : null;
    if (eta !== null && baselineEta.current === null) baselineEta.current = eta;
    const delay = eta !== null ? delaySeconds(eta, baselineEta.current) : 0;
    const slowKey = `${slowSince ?? ''}|${Math.round(delay / 120)}`; // re-publish when slow changes or delay moves by 2 min
    const slowChanged = slowKey !== lastSlowKey.current;
    if (prev && !stopChanged && !slowChanged && (now - prev.t < MIN_INTERVAL_MS || (moved < MIN_MOVE_M && now - prev.t < HEARTBEAT_MS))) return;
    if (prev && now - prev.t < 2_000) return; // never faster than every 2 s
    last.current = { t: now, lat: fix.coordinates.lat, lng: fix.coordinates.lng };
    const etaAt = eta !== null ? new Date(eta).toISOString() : null;
    pushPosition(
      shares.map((s) => s.id),
      fix,
      {
        etaAt,
        traffic: { slowSince: slowSince !== null ? new Date(slowSince).toISOString() : null, delaySeconds: navigating ? delay : null },
        destination: navigating && destination ? { name: destination.name, coordinates: destination.coordinates } : undefined,
        nextStop: stopChanged ? (nextStopName ? { name: nextStopName, left: stopsLeft } : null) : undefined,
      },
    )
      .then(() => {
        lastStopKey.current = nextStopKey;
        lastSlowKey.current = slowKey;
      })
      .catch(() => {
        last.current = prev; // retry on next fix
      });
  }, [fix, shares, navigating, progress, destination, nextStopKey, nextStopName, stopsLeft]);

  // "Until I arrive" shares stop when the trip ends
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if ((was === 'navigating' || was === 'arrived') && (status === 'idle' || status === 'arrived')) {
      const ids = readUntilArrival();
      shares.filter((s) => ids.includes(s.id)).forEach((s) => void stop(s.id).catch(() => {}));
    }
  }, [status, shares, stop]);

  const value = useMemo(() => ({ available, shares, start, stop, stopAll }), [available, shares, start, stop, stopAll]);
  return <LiveShareContext.Provider value={value}>{children}</LiveShareContext.Provider>;
}

export function useLiveShare(): LiveShareValue {
  const ctx = useContext(LiveShareContext);
  if (!ctx) throw new Error('useLiveShare must be used within LiveShareProvider');
  return ctx;
}
