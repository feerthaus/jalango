import { Camera, Coffee, Fuel, Loader2, MapPinPlus, ParkingSquare, ThumbsUp, Utensils, X, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useRouting } from '@/contexts/RoutingContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { features } from '@/lib/config';
import { cn } from '@/lib/cn';
import { fetchCommunityPlaces } from '@/services/communityPlacesService';
import { searchAlongRoute, type AlongCategory } from '@/services/geocodingService';
import type { CommunityCategory, CommunityPlace, Place } from '@/types';
import { rankAlong, samplePointsAhead, type AlongItem } from '@/utils/alongRoute';
import { formatDistance } from '@/utils/geo';
import { buildRouteIndex } from '@/utils/routeProgress';

const CATEGORIES: { id: AlongCategory; label: string; icon: LucideIcon; maxOffsetM: number; community: CommunityCategory[] }[] = [
  { id: 'food', label: 'Makan', icon: Utensils, maxOffsetM: 2500, community: ['food'] },
  { id: 'cafe', label: 'Kafe', icon: Coffee, maxOffsetM: 2500, community: ['cafe'] },
  { id: 'attraction', label: 'Menarik', icon: Camera, maxOffsetM: 8000, community: ['attraction', 'nature'] },
  { id: 'rnr', label: 'R&R', icon: ParkingSquare, maxOffsetM: 800, community: [] },
  { id: 'petrol', label: 'Minyak', icon: Fuel, maxOffsetM: 1500, community: [] },
  { id: 'ev', label: 'EV', icon: Zap, maxOffsetM: 3000, community: [] },
];

interface Row {
  place: Place;
  ahead: number;
  offset: number;
  pick?: CommunityPlace;
}

const communityToPlace = (c: CommunityPlace): Place => ({
  id: `community:${c.id}`,
  name: c.name,
  address: c.address ?? '',
  coordinates: { lat: c.latitude, lng: c.longitude },
  kind: 'poi',
  category: c.category,
  source: 'community',
});

/** Food, cafés, attractions, R&R and fuel ahead on the current route, with "stop here". */
export function AlongRouteSheet({ onClose }: { onClose: () => void }) {
  const { selectedRoute, progress, addStop, stop, clearStop, destination } = useRouting();
  const { searchMode } = useServiceStatus();
  const [category, setCategory] = useState<AlongCategory>('food');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, Row[]>());
  const index = useMemo(() => (selectedRoute ? buildRouteIndex(selectedRoute) : null), [selectedRoute]);
  const along = progress?.along ?? 0;
  const bucket = Math.floor(along / 5000); // refresh every ~5 km driven
  const meta = CATEGORIES.find((c) => c.id === category)!;
  const live = searchMode !== 'demo' && selectedRoute?.source !== 'demo';

  useEffect(() => {
    if (!index || !selectedRoute || !live) return;
    const key = `${selectedRoute.id}:${category}:${bucket}`;
    const hit = cache.current.get(key);
    if (hit) {
      setRows(hit);
      return;
    }
    const controller = new AbortController();
    setRows(null);
    setError(null);
    const here = bucket * 5000;
    const points = samplePointsAhead(index, here);
    const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
    const bounds = { minLat: Math.min(...lats) - 0.08, maxLat: Math.max(...lats) + 0.08, minLng: Math.min(...lngs) - 0.08, maxLng: Math.max(...lngs) + 0.08 };

    Promise.all([
      searchAlongRoute(category, points, controller.signal),
      features.supabase && meta.community.length ? fetchCommunityPlaces(bounds, controller.signal).catch(() => []) : Promise.resolve([] as CommunityPlace[]),
    ])
      .then(([mapbox, community]) => {
        const picks = community.filter((c) => meta.community.includes(c.category));
        const pickRows = rankAlong(picks, (c) => ({ lat: c.latitude, lng: c.longitude }), index, here, Math.max(meta.maxOffsetM, 4000)).map(
          (r: AlongItem<CommunityPlace>) => ({ place: communityToPlace(r.item), ahead: r.ahead, offset: r.offset, pick: r.item }),
        );
        const mbRows = rankAlong(mapbox, (p) => p.coordinates, index, here, meta.maxOffsetM)
          // skip Mapbox duplicates of a community pick (same spot)
          .filter((r) => !pickRows.some((p) => Math.abs(p.ahead - r.ahead) < 150 && Math.abs(p.offset - r.offset) < 150))
          .map((r) => ({ place: r.item, ahead: r.ahead, offset: r.offset }));
        const all = [...pickRows, ...mbRows].sort((a, b) => a.ahead - b.ahead);
        cache.current.set(key, all);
        setRows(all);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Tak dapat cari tempat sekarang.');
        setRows([]);
      });
    return () => controller.abort();
  }, [index, selectedRoute, category, bucket, live, meta]);

  const now = along;
  const visible = (rows ?? []).filter((r) => r.ahead > -300 + (now - bucket * 5000)).map((r) => ({ ...r, ahead: r.ahead - (now - bucket * 5000) }));
  const picks = visible.filter((r) => r.pick).sort((a, b) => b.pick!.recommend_count - a.pick!.recommend_count);
  const others = visible.filter((r) => !r.pick);

  return (
    <Sheet title="Sepanjang laluan" onClose={onClose}>
      {stop && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-violet-500/10 p-3 text-sm">
          <MapPinPlus className="size-4 shrink-0 text-violet-600" />
          <span className="min-w-0 flex-1 truncate">
            Singgah di <strong>{stop.name}</strong>, kemudian ke {destination?.name}
          </span>
          <button type="button" onClick={clearStop} className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-ink-900">
            <X className="size-3.5" /> Batal
          </button>
        </div>
      )}
      <div role="tablist" aria-label="Kategori" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold', category === c.id ? 'bg-jade-500 text-ink-950' : 'bg-ink-100 dark:bg-ink-800')}
          >
            <c.icon className="size-4" /> {c.label}
          </button>
        ))}
      </div>

      {!live ? (
        <p className="text-sm text-ink-500">Carian sepanjang laluan perlukan laluan sebenar dan sambungan internet.</p>
      ) : rows === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-ink-500">
          <Loader2 className="size-4 animate-spin" /> Mencari {meta.label.toLowerCase()} di depan…
        </p>
      ) : (
        <>
          {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
          {visible.length === 0 && !error && <p className="py-4 text-sm text-ink-500">Tiada {meta.label.toLowerCase()} dijumpai berhampiran laluan di depan.</p>}
          {picks.length > 0 && (
            <>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-jade-600">Disyorkan pengguna JalanGo</h3>
              <ul className="mb-3 divide-y divide-ink-100 dark:divide-ink-800">
                {picks.map((r) => (
                  <PlaceItem key={r.place.id} r={r} icon={meta.icon} current={stop?.id === r.place.id} onStop={() => (addStop(r.place), onClose())} />
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              {picks.length > 0 && <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">Lain-lain di depan</h3>}
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {others.slice(0, 30).map((r) => (
                  <PlaceItem key={r.place.id} r={r} icon={meta.icon} current={stop?.id === r.place.id} onStop={() => (addStop(r.place), onClose())} />
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-ink-400">
            Senarai tempat daripada Mapbox, tanpa rating. 👍 = disyorkan pengguna JalanGo.{category === 'rnr' && ' Pastikan R&R berada di arah perjalanan anda.'}
          </p>
        </>
      )}
    </Sheet>
  );
}

function PlaceItem({ r, icon: Icon, current, onStop }: { r: Row; icon: LucideIcon; current: boolean; onStop: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', r.pick ? 'bg-jade-500/15 text-jade-600' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{r.place.name}</p>
        {r.pick?.description ? (
          <p className="truncate text-xs italic text-ink-500">“{r.pick.description}”</p>
        ) : (
          r.place.address && <p className="truncate text-xs text-ink-500">{r.place.address}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          <strong className="text-ink-800 dark:text-ink-100">{r.ahead < 0 ? 'Baru lepas' : `${formatDistance(r.ahead)} lagi`}</strong>
          <span>{r.offset < 200 ? 'tepi jalan' : `${formatDistance(r.offset)} dari laluan`}</span>
          {r.pick && (
            <span className="flex items-center gap-0.5 text-jade-600">
              <ThumbsUp className="size-3" /> {r.pick.recommend_count}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onStop}
        disabled={current}
        className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:bg-violet-600/40"
        aria-label={`Singgah di ${r.place.name}`}
      >
        {current ? 'Dipilih' : 'Singgah'}
      </button>
    </li>
  );
}
