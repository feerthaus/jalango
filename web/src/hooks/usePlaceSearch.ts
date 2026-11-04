import { useEffect, useMemo, useState } from 'react';
import { useLocation } from '@/contexts/LocationContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { searchPlaces } from '@/services/geocodingService';
import type { Place, SearchResponse } from '@/types';
import { haversineMeters } from '@/utils/geo';
import { useDebouncedValue } from './useDebouncedValue';

export interface PlaceSearchState {
  results: Place[];
  loading: boolean;
  error: string | null;
  mode: SearchResponse['mode'] | null;
  notice: string | null;
  /** The (debounced) query the current results belong to */
  query: string;
}

/** Debounced, cancellable autocomplete with automatic demo fallback. */
export function usePlaceSearch(rawQuery: string): PlaceSearchState {
  const query = useDebouncedValue(rawQuery.trim(), 250);
  const { fix } = useLocation();
  const { searchMode } = useServiceStatus();
  const [state, setState] = useState<PlaceSearchState>({ results: [], loading: false, error: null, mode: null, notice: null, query: '' });

  // Proximity bias only needs ~1 km precision; avoids refetching on every GPS tick.
  const nearLat = fix ? Math.round(fix.coordinates.lat * 100) / 100 : null;
  const nearLng = fix ? Math.round(fix.coordinates.lng * 100) / 100 : null;

  useEffect(() => {
    if (query.length < 2 || searchMode === 'checking') {
      setState({ results: [], loading: false, error: null, mode: null, notice: null, query });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const near = nearLat !== null && nearLng !== null ? { lat: nearLat, lng: nearLng } : null;

    searchPlaces(query, { near, signal: controller.signal, live: searchMode === 'live' })
      .then((res) => {
        setState({ results: res.results, loading: false, error: null, mode: res.mode, notice: res.notice ?? null, query });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Search failed';
        setState({ results: [], loading: false, error: message, mode: null, notice: null, query });
      });

    return () => controller.abort();
  }, [query, searchMode, nearLat, nearLng]);

  // Distances use the exact (not rounded) current position.
  const exact = fix?.coordinates;
  return useMemo(
    () => (exact ? { ...state, results: state.results.map((p) => ({ ...p, distanceMeters: haversineMeters(exact, p.coordinates) })) } : state),
    [state, exact],
  );
}
