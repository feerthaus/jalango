import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { speak, useVoiceAlerts, useVoiceLang } from '@/hooks/useVoiceAlerts';
import { alongMeta } from '@/lib/alongCategories';
import { features } from '@/lib/config';
import { fetchCommunityPlaces } from '@/services/communityPlacesService';
import { searchAlongRoute, type AlongCategory } from '@/services/geocodingService';
import type { CommunityPlace, Place } from '@/types';
import { fetchPublicListings, type PublicListing } from '@/services/marketService';
import { aheadPhrase, rankAlong, samplePointsAhead } from '@/utils/alongRoute';
import { buildRouteIndex } from '@/utils/routeProgress';
import { spokenDistance } from '@/utils/voiceInstructions';
import { useRouting } from './RoutingContext';
import { useServiceStatus } from './ServiceStatusContext';

export interface AlongRow {
  place: Place;
  /** metres ahead of the driver (negative = just passed) */
  ahead: number;
  offset: number;
  side: 'left' | 'right' | null;
  pick?: CommunityPlace;
  /** a food business checked by JalanGo (marketplace listing) */
  listing?: PublicListing;
}

interface AlongValue {
  /** Category shown as a layer on the map (null = off) */
  category: AlongCategory | null;
  setCategory: (c: AlongCategory | null) => void;
  rows: AlongRow[] | null;
  error: string | null;
  live: boolean;
  announce: boolean;
  setAnnounce: (on: boolean) => void;
  selected: AlongRow | null;
  select: (r: AlongRow | null) => void;
}

const AlongContext = createContext<AlongValue | null>(null);
/**
 * Re-search only every 40 km: one search already covers ~175 km ahead and the
 * distances are recomputed locally as we drive (each search = up to 8 Mapbox calls).
 */
const BUCKET_M = 40_000;
const ANNOUNCE_KEY = 'jalango:along-announce';
/** Checked food businesses up to 3 km off the route still count as "along" it. */
export const VERIFIED_MAX_OFFSET_M = 3000;
const ANNOUNCE_GAP_MS = 45_000;

export const listingToPlace = (l: PublicListing): Place => ({
  id: `listing:${l.id}`,
  name: l.title,
  address: l.area_label,
  coordinates: { lat: l.latitude, lng: l.longitude },
  kind: 'poi',
  category: 'food',
  source: 'link',
});

const communityToPlace = (c: CommunityPlace): Place => ({
  id: `community:${c.id}`,
  name: c.name,
  address: c.address ?? '',
  coordinates: { lat: c.latitude, lng: c.longitude },
  kind: 'poi',
  category: c.category,
  source: 'community',
});

/**
 * Places along the current route for one category: fetched in ~5 km steps,
 * plotted on the map, listed in the sheet, and (optionally) announced by voice
 * as the driver gets close.
 */
export function AlongProvider({ children }: { children: ReactNode }) {
  const { selectedRoute, progress, status } = useRouting();
  const { searchMode } = useServiceStatus();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const [category, setCategoryState] = useState<AlongCategory | null>(null);
  const [baseRows, setBaseRows] = useState<{ base: number; rows: AlongRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AlongRow | null>(null);
  const [announce, setAnnounceState] = useState(() => {
    try {
      return localStorage.getItem(ANNOUNCE_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const cache = useRef(new Map<string, AlongRow[]>());
  const announced = useRef(new Set<string>());
  const lastSpoken = useRef(0);

  const index = useMemo(() => (selectedRoute ? buildRouteIndex(selectedRoute) : null), [selectedRoute]);
  const along = progress?.along ?? 0;
  const bucket = Math.floor(Math.max(0, along) / BUCKET_M);
  const live = searchMode !== 'demo' && Boolean(selectedRoute) && selectedRoute?.source !== 'demo';

  const setCategory = useCallback((c: AlongCategory | null) => {
    setCategoryState(c);
    setSelected(null);
  }, []);
  const setAnnounce = useCallback((on: boolean) => {
    setAnnounceState(on);
    try {
      localStorage.setItem(ANNOUNCE_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, []);

  // Route gone (trip ended / cleared): turn the layer off
  useEffect(() => {
    if (status === 'idle') {
      setCategoryState(null);
      setSelected(null);
      announced.current.clear();
    }
  }, [status]);

  // Switching category: drop the old pins straight away
  useEffect(() => {
    setBaseRows(null);
    setError(null);
  }, [category]);

  useEffect(() => {
    if (!category || !index || !selectedRoute || !live) {
      setBaseRows(null);
      return;
    }
    const base = bucket * BUCKET_M;
    const key = `${selectedRoute.id}:${category}:${bucket}`;
    const hit = cache.current.get(key);
    if (hit) {
      setBaseRows({ base, rows: hit });
      return;
    }
    const meta = alongMeta(category);
    const controller = new AbortController();
    setError(null);
    setBaseRows((prev) => (prev && prev.rows.length ? prev : null)); // keep old pins while refreshing
    const points = samplePointsAhead(index, base);
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const bounds = { minLat: Math.min(...lats) - 0.08, maxLat: Math.max(...lats) + 0.08, minLng: Math.min(...lngs) - 0.08, maxLng: Math.max(...lngs) + 0.08 };

    Promise.all([
      searchAlongRoute(category, points, controller.signal),
      features.supabase && meta.community.length ? fetchCommunityPlaces(bounds, controller.signal).catch(() => []) : Promise.resolve([] as CommunityPlace[]),
      // Food businesses checked by JalanGo, for the "Makan" layer only
      features.supabase && category === 'food' ? fetchPublicListings('food').catch(() => [] as PublicListing[]) : Promise.resolve([] as PublicListing[]),
    ])
      .then(([mapbox, community, listings]) => {
        const verified: AlongRow[] = rankAlong(
          listings.filter((l) => l.latitude >= bounds.minLat && l.latitude <= bounds.maxLat && l.longitude >= bounds.minLng && l.longitude <= bounds.maxLng),
          (l) => ({ lat: l.latitude, lng: l.longitude }),
          index,
          base,
          VERIFIED_MAX_OFFSET_M,
        ).map((r) => ({ place: listingToPlace(r.item), ahead: r.ahead, offset: r.offset, side: r.side, listing: r.item }));
        const picks: AlongRow[] = rankAlong(
          community.filter((c) => meta.community.includes(c.category)),
          (c) => ({ lat: c.latitude, lng: c.longitude }),
          index,
          base,
          Math.max(meta.maxOffsetM, 4000),
        ).map((r) => ({ place: communityToPlace(r.item), ahead: r.ahead, offset: r.offset, side: r.side, pick: r.item }));
        const others: AlongRow[] = rankAlong(mapbox, (p) => p.coordinates, index, base, meta.maxOffsetM)
          .filter((r) => !picks.some((p) => Math.abs(p.ahead - r.ahead) < 150 && Math.abs(p.offset - r.offset) < 150))
          .map((r) => ({ place: r.item, ahead: r.ahead, offset: r.offset, side: r.side }));
        const rows = [...verified, ...picks, ...others].sort((a, b) => a.ahead - b.ahead);
        cache.current.set(key, rows);
        setBaseRows({ base, rows });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Tak dapat cari tempat sekarang.');
        setBaseRows({ base, rows: [] });
      });
    return () => controller.abort();
  }, [category, index, selectedRoute, bucket, live]);

  // Distances relative to where we are now
  const rows = useMemo(() => {
    if (!baseRows) return null;
    const moved = along - baseRows.base;
    return baseRows.rows.map((r) => ({ ...r, ahead: r.ahead - moved })).filter((r) => r.ahead > -300);
  }, [baseRows, along]);

  // Voice: "Warung Sham, 800 meter di depan, sebelah kanan."
  useEffect(() => {
    if (!announce || !voiceOn || status !== 'navigating' || !rows) return;
    if (Date.now() - lastSpoken.current < ANNOUNCE_GAP_MS) return;
    const next = rows
      .filter((r) => r.ahead > 300 && r.ahead <= 900 && r.offset <= 1000 && !announced.current.has(r.place.id))
      .sort((a, b) => Number(Boolean(b.pick)) - Number(Boolean(a.pick)) || a.ahead - b.ahead)[0];
    if (!next) return;
    announced.current.add(next.place.id);
    lastSpoken.current = Date.now();
    speak(aheadPhrase(next.place.name, next.ahead, next.side, lang, (m) => spokenDistance(m, lang)), lang);
  }, [rows, announce, voiceOn, status, lang]);

  // Keep the selected card's distance fresh
  const selectedFresh = useMemo(() => (selected ? (rows?.find((r) => r.place.id === selected.place.id) ?? selected) : null), [selected, rows]);

  const value = useMemo<AlongValue>(
    () => ({ category, setCategory, rows, error, live, announce, setAnnounce, selected: selectedFresh, select: setSelected }),
    [category, setCategory, rows, error, live, announce, setAnnounce, selectedFresh],
  );
  return <AlongContext.Provider value={value}>{children}</AlongContext.Provider>;
}

export function useAlong(): AlongValue {
  const ctx = useContext(AlongContext);
  if (!ctx) throw new Error('useAlong must be used within AlongProvider');
  return ctx;
}
