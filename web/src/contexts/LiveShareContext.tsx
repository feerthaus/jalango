import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { features } from '@/lib/config';
import { createShare, fetchMyActiveShares, pushPosition, stopShare, type DriverInfo, type LiveShare } from '@/services/liveShareService';
import { useItinerary } from './ItineraryContext';
import { haversineMeters } from '@/utils/geo';
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
  const { status, destination, progress } = useRouting();
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
    if (prev && !stopChanged && (now - prev.t < MIN_INTERVAL_MS || (moved < MIN_MOVE_M && now - prev.t < HEARTBEAT_MS))) return;
    last.current = { t: now, lat: fix.coordinates.lat, lng: fix.coordinates.lng };
    const navigating = status === 'navigating';
    const etaAt = navigating && progress ? new Date(now + progress.remainingSeconds * 1000).toISOString() : null;
    pushPosition(
      shares.map((s) => s.id),
      fix,
      {
        etaAt,
        destination: navigating && destination ? { name: destination.name, coordinates: destination.coordinates } : undefined,
        nextStop: stopChanged ? (nextStopName ? { name: nextStopName, left: stopsLeft } : null) : undefined,
      },
    )
      .then(() => {
        lastStopKey.current = nextStopKey;
      })
      .catch(() => {
        last.current = prev; // retry on next fix
      });
  }, [fix, shares, status, progress, destination, nextStopKey, nextStopName, stopsLeft]);

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
