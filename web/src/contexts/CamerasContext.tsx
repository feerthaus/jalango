import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from '@/hooks/useVoiceAlerts';
import { apiGet } from '@/services/apiClient';
import type { Route } from '@/types';
import { rankAlong, type AlongItem } from '@/utils/alongRoute';
import { buildRouteIndex } from '@/utils/routeProgress';
import { spokenDistance } from '@/utils/voiceInstructions';
import { limitAt } from '@/utils/speedLimit';
import { useRouting } from './RoutingContext';
import { useServiceStatus } from './ServiceStatusContext';

export interface SpeedCamera {
  id: string;
  lat: number;
  lng: number;
  maxspeed: number | null;
}

const TILE_DEG = 0.5;
const MAX_TILES = 40;
/** cameras sit at the roadside: tighter than reports so the other carriageway rarely matches */
const ON_ROUTE_M = 35;

/** 0.5° tiles the route passes through (sampled along the line). */
export function tilesForRoute(route: Route): string[] {
  const tiles = new Set<string>();
  const coords = route.geometry.coordinates as [number, number][];
  const step = Math.max(1, Math.floor(coords.length / 400));
  for (let i = 0; i < coords.length; i += step) tiles.add(`${Math.floor(coords[i][0] / TILE_DEG)}:${Math.floor(coords[i][1] / TILE_DEG)}`);
  const last = coords[coords.length - 1];
  if (last) tiles.add(`${Math.floor(last[0] / TILE_DEG)}:${Math.floor(last[1] / TILE_DEG)}`);
  return [...tiles].slice(0, MAX_TILES);
}

interface CamerasValue {
  /** fixed cameras on the route, nearest first (ahead may be negative just after passing) */
  ahead: (AlongItem<SpeedCamera> & { limit: number | null })[];
}

const CamerasContext = createContext<CamerasValue>({ ahead: [] });
const tileCache = new Map<string, SpeedCamera[]>();

/** Fixed AES/AWAS cameras on the current route (OpenStreetMap), with a spoken warning. */
export function CamerasProvider({ children }: { children: ReactNode }) {
  const { selectedRoute, progress, status } = useRouting();
  const { searchMode } = useServiceStatus();
  const [voiceOn] = useVoiceAlerts();
  const [lang] = useVoiceLang();
  const [cameras, setCameras] = useState<SpeedCamera[]>([]);
  const announced = useRef(new Set<string>());
  const live = searchMode !== 'demo' && selectedRoute && selectedRoute.source !== 'demo';

  useEffect(() => {
    if (!live || !selectedRoute) {
      setCameras([]);
      return;
    }
    const controller = new AbortController();
    const tiles = tilesForRoute(selectedRoute);
    (async () => {
      const found: SpeedCamera[] = [];
      for (const t of tiles) {
        if (controller.signal.aborted) return;
        const hit = tileCache.get(t);
        if (hit) {
          found.push(...hit);
          continue;
        }
        const [x, y] = t.split(':');
        try {
          const res = await apiGet<{ cameras: SpeedCamera[]; unavailable?: boolean }>('/cameras/tile', { x, y }, controller.signal);
          if (res.unavailable) break; // source is down: don't keep asking
          tileCache.set(t, res.cameras);
          found.push(...res.cameras);
        } catch {
          break; // camera data is a bonus: never block navigation
        }
      }
      if (!controller.signal.aborted) setCameras(found);
    })();
    return () => controller.abort();
  }, [live, selectedRoute]);

  const index = useMemo(() => (selectedRoute ? buildRouteIndex(selectedRoute) : null), [selectedRoute]);
  const onRoute = useMemo(
    () => (index && cameras.length ? rankAlong(cameras, (c) => ({ lat: c.lat, lng: c.lng }), index, 0, ON_ROUTE_M, 0) : []),
    [index, cameras],
  );
  const along = progress?.along ?? 0;
  const ahead = useMemo(
    () =>
      onRoute
        .map((c) => ({ ...c, ahead: c.ahead - along, limit: c.item.maxspeed }))
        .filter((c) => c.ahead > -200)
        .map((c) => ({ ...c, limit: c.limit ?? (index && selectedRoute ? limitAt(selectedRoute, segmentAt(index, along + c.ahead)) : null) })),
    [onRoute, along, index, selectedRoute],
  );

  // "Kamera AWAS 800 meter di depan, had laju 90."
  useEffect(() => {
    if (status !== 'navigating') return;
    const next = ahead.find((c) => c.ahead > 0);
    if (!next || announced.current.has(next.item.id)) return;
    const fast = next.ahead <= 1200; // announce ~1 km before
    if (!fast) return;
    announced.current.add(next.item.id);
    vibrate([150, 80, 150]);
    if (!voiceOn) return;
    const d = spokenDistance(next.ahead, lang);
    const lim = next.limit ? (lang === 'ms' ? `, had laju ${next.limit}` : `, speed limit ${next.limit}`) : '';
    speak(lang === 'ms' ? `Kamera AWAS ${d} di depan${lim}.` : `Speed camera ${d} ahead${lim}.`, lang);
  }, [ahead, status, voiceOn, lang]);

  const value = useMemo(() => ({ ahead }), [ahead]);
  return <CamerasContext.Provider value={value}>{children}</CamerasContext.Provider>;
}

function segmentAt(index: ReturnType<typeof buildRouteIndex>, distance: number): number {
  let i = 1;
  while (i < index.cum.length - 1 && index.cum[i] < distance) i++;
  return i - 1;
}

export function useCameras(): CamerasValue {
  return useContext(CamerasContext);
}
