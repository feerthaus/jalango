import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { speak, useVoiceAlerts, useVoiceLang, vibrate } from '@/hooks/useVoiceAlerts';
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

/** cameras sit at the roadside: tighter than reports so the other carriageway rarely matches */
const ON_ROUTE_M = 35;

let allCameras: Promise<SpeedCamera[]> | null = null;
/** Malaysia's fixed cameras, exported weekly from OpenStreetMap into a static file (small, CDN-cached). */
export function loadAllCameras(): Promise<SpeedCamera[]> {
  allCameras ??= fetch('/data/speed-cameras.json')
    .then((r) => (r.ok ? r.json() : { cameras: [] }))
    .then((d: { cameras?: SpeedCamera[] }) => d.cameras ?? [])
    .catch(() => {
      allCameras = null; // retry next time
      return [];
    });
  return allCameras;
}

interface CamerasValue {
  /** fixed cameras on the route, nearest first (ahead may be negative just after passing) */
  ahead: (AlongItem<SpeedCamera> & { limit: number | null })[];
}

const CamerasContext = createContext<CamerasValue>({ ahead: [] });

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
    let cancelled = false;
    // Only cameras inside the route's bounding box (+~1 km) are worth projecting
    const coords = selectedRoute.geometry.coordinates as [number, number][];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const box = { minLng: Math.min(...lngs) - 0.01, maxLng: Math.max(...lngs) + 0.01, minLat: Math.min(...lats) - 0.01, maxLat: Math.max(...lats) + 0.01 };
    loadAllCameras().then((all) => {
      if (cancelled) return;
      setCameras(all.filter((c) => c.lng >= box.minLng && c.lng <= box.maxLng && c.lat >= box.minLat && c.lat <= box.maxLat));
    });
    return () => {
      cancelled = true;
    };
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
