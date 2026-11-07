import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Place } from '@/types';
import { haversineMeters } from '@/utils/geo';
import { useRouting } from './RoutingContext';

export interface ItineraryStop {
  place: Place;
  done: boolean;
}

interface ItineraryValue {
  stops: ItineraryStop[];
  /** first stop not yet visited */
  nextIndex: number;
  /** the stop we're driving to right now (destination matches it) */
  activeIndex: number;
  add: (place: Place) => void;
  remove: (index: number) => void;
  move: (index: number, by: -1 | 1) => void;
  clear: () => void;
  has: (place: Place) => boolean;
  /** start / continue: navigate to the next unvisited stop */
  goNext: () => void;
  /** mark a stop visited without driving there */
  skip: (index: number) => void;
}

const KEY = 'jalango:itinerary';
const MAX_STOPS = 20;
const ItineraryContext = createContext<ItineraryValue | null>(null);

function load(): ItineraryStop[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as ItineraryStop[];
    return Array.isArray(v) ? v.filter((s) => s?.place?.coordinates).slice(0, MAX_STOPS) : [];
  } catch {
    return [];
  }
}

const samePlace = (a: Place, b: Place) => a.id === b.id || haversineMeters(a.coordinates, b.coordinates) < 30;

/** A day's list of stops (tour, deliveries, visiting relatives): drive them one after another. */
export function ItineraryProvider({ children }: { children: ReactNode }) {
  const { navigateTo, destination, status } = useRouting();
  const [stops, setStops] = useState<ItineraryStop[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stops));
    } catch {
      /* ignore */
    }
  }, [stops]);

  const activeIndex = destination ? stops.findIndex((s) => !s.done && samePlace(s.place, destination)) : -1;
  const nextIndex = stops.findIndex((s) => !s.done);

  // Arriving at the active stop ticks it off
  useEffect(() => {
    if (status !== 'arrived' || activeIndex === -1) return;
    setStops((all) => all.map((s, i) => (i === activeIndex ? { ...s, done: true } : s)));
  }, [status, activeIndex]);

  const add = useCallback((place: Place) => {
    setStops((all) => (all.some((s) => samePlace(s.place, place)) || all.length >= MAX_STOPS ? all : [...all, { place, done: false }]));
  }, []);
  const remove = useCallback((index: number) => setStops((all) => all.filter((_, i) => i !== index)), []);
  const move = useCallback((index: number, by: -1 | 1) => {
    setStops((all) => {
      const j = index + by;
      if (j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);
  const clear = useCallback(() => setStops([]), []);
  const has = useCallback((place: Place) => stops.some((s) => samePlace(s.place, place)), [stops]);
  const skip = useCallback((index: number) => setStops((all) => all.map((s, i) => (i === index ? { ...s, done: true } : s))), []);
  const goNext = useCallback(() => {
    const next = stops.find((s) => !s.done);
    if (next) navigateTo(next.place);
  }, [stops, navigateTo]);

  const value = useMemo(
    () => ({ stops, nextIndex, activeIndex, add, remove, move, clear, has, goNext, skip }),
    [stops, nextIndex, activeIndex, add, remove, move, clear, has, goNext, skip],
  );
  return <ItineraryContext.Provider value={value}>{children}</ItineraryContext.Provider>;
}

export function useItinerary(): ItineraryValue {
  const ctx = useContext(ItineraryContext);
  if (!ctx) throw new Error('useItinerary must be used within ItineraryProvider');
  return ctx;
}
