import mapboxgl from 'mapbox-gl';
import { Car, Home, List, Map as MapIcon, Store } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import { ListingCard } from '@/components/market/ListingCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PagePanel } from '@/components/ui/PagePanel';
import { Spinner } from '@/components/ui/Spinner';
import { useLocation } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapContext';
import { useIsNavigating } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { rm } from '@/lib/listingLabels';
import { supabase } from '@/lib/supabase';
import { fetchPublicListings, type PublicListing } from '@/services/marketService';
import type { OperatorKind } from '@/services/operatorService';
import { haversineMeters } from '@/utils/geo';

const KINDS: { id: OperatorKind | 'all'; label: string; icon?: typeof Car }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'car_rental', label: 'Kereta sewa', icon: Car },
  { id: 'homestay', label: 'Homestay', icon: Home },
];

/** "Sewa": verified car rentals and homestays, nearest first. Never shown while driving. */
export function SewaPage() {
  const navigating = useIsNavigating();
  const [params, setParams] = useSearchParams();
  const kind = (params.get('jenis') as OperatorKind | null) ?? 'all';
  const view = params.get('papar') === 'peta' ? 'peta' : 'senarai';
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };
  const { fix } = useLocation();
  const { map } = useMapContext();
  const [items, setItems] = useState<PublicListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (navigating || !supabase) return;
    let alive = true;
    setItems(null);
    fetchPublicListings(kind === 'all' ? undefined : kind)
      .then((l) => alive && setItems(l))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [kind, navigating]);

  const origin = fix?.coordinates ?? (map ? { lng: map.getCenter().lng, lat: map.getCenter().lat } : null);
  const originKey = origin ? `${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}` : '';
  const sorted = useMemo(() => {
    if (!items) return null;
    const withD = items.map((l) => ({ l, d: origin ? haversineMeters(origin, { lat: l.latitude, lng: l.longitude }) : null }));
    return withD.sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, originKey]);

  if (navigating) {
    return (
      <PagePanel title="Sewa">
        <EmptyState icon={Car} title="Tidak dipaparkan semasa memandu">Fokus pada jalan. Buka semula selepas anda berhenti.</EmptyState>
      </PagePanel>
    );
  }

  const toggles = (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {KINDS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={kind === id}
          onClick={() => set('jenis', id === 'all' ? null : id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
            kind === id ? 'bg-jade-500 text-ink-950' : 'bg-white shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800',
          )}
        >
          {Icon && <Icon className="size-4" />} {label}
        </button>
      ))}
    </div>
  );
  const viewSwitch = (
    <button
      type="button"
      onClick={() => set('papar', view === 'peta' ? null : 'peta')}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-800"
    >
      {view === 'peta' ? <List className="size-4" /> : <MapIcon className="size-4" />} {view === 'peta' ? 'Senarai' : 'Peta'}
    </button>
  );

  if (view === 'peta') {
    return <SewaMap items={sorted?.map((x) => x.l) ?? []} toggles={toggles} viewSwitch={viewSwitch} />;
  }

  return (
    <PagePanel title="Sewa" subtitle="Kereta sewa & homestay yang disemak JalanGo" action={viewSwitch}>
      {toggles}
      {!supabase && <EmptyState icon={Store} title="Belum bersambung">Senarai sewaan perlukan sambungan ke pelayan.</EmptyState>}
      {error && <p role="alert" className="py-4 text-sm text-red-600">{error}</p>}
      {supabase && !sorted && !error && <div className="grid place-items-center py-10"><Spinner label="Memuatkan" /></div>}
      {sorted && sorted.length === 0 && (
        <EmptyState icon={Store} title="Belum ada sewaan di sini">Operator baru sedang disemak. Cuba lagi nanti.</EmptyState>
      )}
      <ul className="grid gap-3 sm:grid-cols-1">
        {sorted?.map(({ l, d }) => (
          <li key={l.id}>
            <ListingCard l={l} distance={d} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-ink-500">
        Ada kereta sewa atau homestay? <Link to="/business" className="font-semibold text-jade-600 underline">Daftar perniagaan</Link>
      </p>
    </PagePanel>
  );
}

/** Price pins on the shared map, with a card for the tapped one. */
function SewaMap({ items, toggles, viewSwitch }: { items: PublicListing[]; toggles: React.ReactNode; viewSwitch: React.ReactNode }) {
  const { map } = useMapContext();
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>());
  const [, force] = useState(0);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    const cur = markers.current;
    for (const m of cur.values()) m.marker.remove();
    cur.clear();
    for (const l of items) {
      const el = document.createElement('div');
      cur.set(l.id, { marker: new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.longitude, l.latitude]).addTo(map), el });
    }
    if (items.length) {
      const b = new mapboxgl.LngLatBounds();
      items.forEach((l) => b.extend([l.longitude, l.latitude]));
      map.fitBounds(b, { padding: { top: 140, bottom: 220, left: 40, right: 40 }, maxZoom: 13, duration: 600 });
    }
    force((n) => n + 1);
    return () => {
      for (const m of cur.values()) m.marker.remove();
      cur.clear();
    };
  }, [map, items]);

  const selected = items.find((l) => l.id === sel);
  return (
    <>
      <div className="safe-top pointer-events-auto absolute inset-x-0 top-0 z-10 px-4 pt-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{toggles}</div>
          {viewSwitch}
        </div>
      </div>
      {items.map((l) => {
        const m = markers.current.get(l.id);
        if (!m) return null;
        return createPortal(
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSel(l.id);
            }}
            aria-label={`${l.title}, ${rm(l.price)}`}
            className={cn('rounded-full border-2 border-white px-2 py-0.5 text-xs font-black shadow-md', sel === l.id ? 'bg-ink-950 text-white' : 'bg-jade-500 text-ink-950')}
          >
            {rm(l.price)}
          </button>,
          m.el,
          l.id,
        );
      })}
      {selected && (
        <div className="pointer-events-auto absolute inset-x-4 bottom-[calc(4.5rem+var(--bottom-clear))] z-10 mx-auto max-w-md">
          <ListingCard l={selected} />
        </div>
      )}
    </>
  );
}
