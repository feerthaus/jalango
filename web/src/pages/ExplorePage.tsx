import { AlertTriangle, BatteryCharging, Coffee, Fuel, Hospital, MapPinned, ParkingSquare, RefreshCw, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlaceRow } from '@/components/places/PlaceRow';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useServiceStatus } from '@/contexts/ServiceStatusContext';
import { DEMO_PLACES, STATE_CAPITALS } from '@/data/demoPlaces';
import { useShowOnMap } from '@/hooks/useShowOnMap';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { CommunityPicks } from '@/components/community/CommunityPicks';
import { useNavigate } from 'react-router';
import { formatDistance } from '@/utils/geo';
import { cn } from '@/lib/cn';
import { searchNearbyCategory } from '@/services/geocodingService';
import type { Coordinates, ExploreCategory, Place } from '@/types';

const CATEGORIES: { id: ExploreCategory; label: string; icon: LucideIcon }[] = [
  { id: 'petrol', label: 'Petrol', icon: Fuel },
  { id: 'rnr', label: 'R&R', icon: Coffee },
  { id: 'ev', label: 'EV charging', icon: BatteryCharging },
  { id: 'parking', label: 'Parking', icon: ParkingSquare },
  { id: 'hospital', label: 'Hospital', icon: Hospital },
];

type NearbyState = { status: 'idle' | 'loading' | 'done' | 'error'; results: Place[]; error?: string };

export function ExplorePage() {
  const { searchMode } = useServiceStatus();
  const { fix } = useLocation();
  const { map } = useMapContext();
  const showOnMap = useShowOnMap();
  const [category, setCategory] = useState<ExploreCategory | null>(null);
  const [nearby, setNearby] = useState<NearbyState>({ status: 'idle', results: [] });
  const [nonce, setNonce] = useState(0);

  const origin: { coords: Coordinates; label: string } | null = fix
    ? { coords: fix.coordinates, label: 'your location' }
    : map
      ? { coords: { lng: map.getCenter().lng, lat: map.getCenter().lat }, label: 'the map centre' }
      : null;
  const originKey = origin ? `${origin.coords.lat.toFixed(2)},${origin.coords.lng.toFixed(2)}` : null;

  useEffect(() => {
    if (!category || searchMode !== 'live' || !origin) return;
    const controller = new AbortController();
    setNearby({ status: 'loading', results: [] });
    searchNearbyCategory(category, origin.coords, controller.signal)
      .then((results) => setNearby({ status: 'done', results }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setNearby({ status: 'error', results: [], error: err instanceof Error ? err.message : 'Request failed' });
      });
    return () => controller.abort();
    // origin is represented by originKey to avoid refetching on tiny GPS changes
  }, [category, searchMode, originKey, nonce]);

  return (
    <PagePanel title="Explore" subtitle="Malaysia-first places along your way">
      <h2 className="px-1 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Nearby</h2>
      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Nearby categories">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => setCategory(id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
              category === id ? 'bg-jade-500 text-ink-950' : 'bg-white shadow-sm ring-1 ring-ink-200 hover:bg-ink-100 dark:bg-ink-900 dark:ring-ink-800 dark:hover:bg-ink-800',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        <NearbyResults
          category={category}
          state={nearby}
          live={searchMode === 'live'}
          checking={searchMode === 'checking'}
          originLabel={origin?.label}
          onSelect={(p) => showOnMap(p)}
          onRetry={() => setNonce((n) => n + 1)}
        />
      </div>

      <CommunityPicks />

      <CommunityShortcuts />

      <h2 className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-ink-400">States &amp; cities</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STATE_CAPITALS.map(({ state, placeId }) => {
          const place = DEMO_PLACES.find((p) => p.id === placeId)!;
          return (
            <button
              key={state}
              type="button"
              onClick={() => showOnMap(place)}
              className="rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-ink-200 transition hover:ring-jade-500 dark:bg-ink-900 dark:ring-ink-800"
            >
              <span className="block text-sm font-semibold">{state}</span>
              <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{place.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-xs text-ink-400">City shortcuts use approximate city-centre coordinates.</p>
    </PagePanel>
  );
}

function NearbyResults(props: {
  category: ExploreCategory | null;
  state: NearbyState;
  live: boolean;
  checking: boolean;
  originLabel?: string;
  onSelect: (p: Place) => void;
  onRetry: () => void;
}) {
  const { category, state, live, checking, originLabel, onSelect, onRetry } = props;

  if (!category) {
    return <EmptyState icon={MapPinned} title="Find petrol, R&R and more">Pick a category to see places near {originLabel ?? 'you'}.</EmptyState>;
  }
  if (checking) {
    return <EmptyState icon={RefreshCw} title="Checking services…" />;
  }
  if (!live) {
    return (
      <EmptyState icon={AlertTriangle} title="Live place data not connected">
        <p>
          Nearby petrol stations, R&amp;Rs and other places come from Mapbox and need the server’s <code>MAPBOX_ACCESS_TOKEN</code>.
        </p>
        <p className="mt-2">
          <DemoBadge label="Demo mode" /> We don’t show made-up locations.
        </p>
      </EmptyState>
    );
  }
  if (state.status === 'loading') {
    return (
      <ul aria-busy className="space-y-1 p-1">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-14 animate-pulse rounded-xl bg-ink-100 dark:bg-ink-800" />
        ))}
      </ul>
    );
  }
  if (state.status === 'error') {
    return (
      <EmptyState icon={AlertTriangle} title="Couldn’t load nearby places">
        <p>{state.error}</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </EmptyState>
    );
  }
  if (state.results.length === 0) {
    return <EmptyState icon={MapPinned} title="Nothing found nearby">Try another category or move the map.</EmptyState>;
  }
  return (
    <>
      <p className="px-2 pb-1 pt-1 text-xs text-ink-400">Near {originLabel}</p>
      <ul role="listbox" aria-label="Nearby places">
        {state.results.map((p) => (
          <PlaceRow key={p.id} place={p} onSelect={onSelect} />
        ))}
      </ul>
    </>
  );
}

function CommunityShortcuts() {
  const { available, shortcuts, selectShortcut } = useShortcuts();
  const navigate = useNavigate();
  if (!available) return null;
  return (
    <>
      <h2 className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wider text-ink-400">Community shortcuts nearby</h2>
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800">
        {shortcuts.length === 0 ? (
          <p className="p-3 text-sm text-ink-500 dark:text-ink-400">
            No shortcuts shared around here yet. After a trip, open <strong>Saved → Trips</strong> and tap <strong>Shortcut</strong> to share the road you took.
          </p>
        ) : (
          <ul>
            {shortcuts.slice(0, 8).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectShortcut(s);
                    navigate('/');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-ink-100 dark:hover:bg-ink-800"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500 text-white">
                    <MapPinned className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="block truncate text-xs text-ink-500 dark:text-ink-400">
                      {formatDistance(s.distance_m)}
                      {s.avoids && ` · avoids ${s.avoids}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-violet-600 dark:text-violet-300">👍 {s.upvotes}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
