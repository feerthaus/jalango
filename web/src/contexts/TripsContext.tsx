import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { deleteRemoteTrip, loadTrips, storeTrips, syncTrip } from '@/services/tripHistory';
import type { Trip, TripTag } from '@/types';
import { useAuth } from './AuthContext';

interface TripsValue {
  trips: Trip[];
  /** Adds a finished trip; returns its id */
  recordTrip: (trip: Omit<Trip, 'id'>) => string;
  rateTrip: (id: string, rating: number, tags: TripTag[], comment: string) => void;
  removeTrip: (id: string) => void;
  clearTrips: () => void;
  getTrip: (id: string) => Trip | undefined;
}

const TripsContext = createContext<TripsValue | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>(loadTrips);

  const update = useCallback((fn: (prev: Trip[]) => Trip[]) => setTrips((prev) => storeTrips(fn(prev))), []);

  // Push a trip to the signed-in user's history, remembering the remote id
  const sync = useCallback(
    (trip: Trip) => {
      if (!user) return;
      syncTrip(trip, user.id)
        .then((remoteId) => remoteId && remoteId !== trip.remoteId && update((prev) => prev.map((t) => (t.id === trip.id ? { ...t, remoteId } : t))))
        .catch((err) => console.warn('[JalanGo] trip sync failed', err));
    },
    [user, update],
  );

  const recordTrip = useCallback(
    (trip: Omit<Trip, 'id'>) => {
      const full: Trip = { ...trip, id: crypto.randomUUID() };
      update((prev) => [full, ...prev]);
      sync(full);
      return full.id;
    },
    [update, sync],
  );

  const rateTrip = useCallback(
    (id: string, rating: number, tags: TripTag[], comment: string) => {
      let rated: Trip | undefined;
      update((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          rated = { ...t, rating: Math.max(1, Math.min(5, Math.round(rating))), ratingTags: tags, ratingComment: comment.trim() || undefined };
          return rated;
        }),
      );
      if (rated) sync(rated);
    },
    [update, sync],
  );

  const removeTrip = useCallback(
    (id: string) => {
      update((prev) => {
        const t = prev.find((x) => x.id === id);
        if (t?.remoteId) void deleteRemoteTrip(t.remoteId);
        return prev.filter((x) => x.id !== id);
      });
    },
    [update],
  );

  const value = useMemo<TripsValue>(
    () => ({
      trips,
      recordTrip,
      rateTrip,
      removeTrip,
      clearTrips: () => update(() => []),
      getTrip: (id) => trips.find((t) => t.id === id),
    }),
    [trips, recordTrip, rateTrip, removeTrip, update],
  );
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips(): TripsValue {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used within TripsProvider');
  return ctx;
}
