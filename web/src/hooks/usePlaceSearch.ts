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
  /** Results are for this AI-corrected text (nothing matched what was typed) */
  rewrittenTo: string | null;
  /** Nothing found; the smart search (AI) is trying again */
  aiTrying: boolean;
}

/** After an empty result, wait this long for more typing before asking the AI (saves calls while typing). */
const AI_AFTER_MS = 900;

/** Debounced, cancellable autocomplete with automatic demo fallback. */
export function usePlaceSearch(rawQuery: string): PlaceSearchState {
  const query = useDebouncedValue(rawQuery.trim(), 250);
  const { fix } = useLocation();
  const { searchMode } = useServiceStatus();
  const [state, setState] = useState<PlaceSearchState>({ results: [], loading: false, error: null, mode: null, notice: null, query: '', rewrittenTo: null, aiTrying: false });

  // Proximity bias only needs ~1 km precision; avoids refetching on every GPS tick.
  const nearLat = fix ? Math.round(fix.coordinates.lat * 100) / 100 : null;
  const nearLng = fix ? Math.round(fix.coordinates.lng * 100) / 100 : null;

  useEffect(() => {
    if (query.length < 2 || searchMode === 'checking') {
      setState({ results: [], loading: false, error: null, mode: null, notice: null, query, rewrittenTo: null, aiTrying: false });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const near = nearLat !== null && nearLng !== null ? { lat: nearLat, lng: nearLng } : null;

    let aiTimer: number | undefined;
    const live = searchMode === 'live';
    searchPlaces(query, { near, signal: controller.signal, live })
      .then((res) => {
        // Nothing found while live: once typing has paused, let the smart search (AI) try
        const tryAi = live && res.mode === 'live' && res.results.length === 0 && !res.notice && query.length >= 3;
        setState({ results: res.results, loading: false, error: null, mode: res.mode, notice: res.notice ?? null, query, rewrittenTo: null, aiTrying: tryAi });
        if (!tryAi) return;
        aiTimer = window.setTimeout(() => {
          searchPlaces(query, { near, signal: controller.signal, live, ai: true })
            .then((ai) => setState((s) => (s.query === query ? { ...s, results: ai.results, rewrittenTo: ai.rewrittenTo ?? null, aiTrying: false } : s)))
            .catch(() => setState((s) => (s.query === query ? { ...s, aiTrying: false } : s)));
        }, AI_AFTER_MS);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Search failed';
        setState({ results: [], loading: false, error: message, mode: null, notice: null, query, rewrittenTo: null, aiTrying: false });
      });

    return () => {
      window.clearTimeout(aiTimer);
      controller.abort();
    };
  }, [query, searchMode, nearLat, nearLng]);

  // Distances use the exact (not rounded) current position.
  const exact = fix?.coordinates;
  return useMemo(
    () => (exact ? { ...state, results: state.results.map((p) => ({ ...p, distanceMeters: haversineMeters(exact, p.coordinates) })) } : state),
    [state, exact],
  );
}
