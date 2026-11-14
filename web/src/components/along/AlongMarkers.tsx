import mapboxgl from 'mapbox-gl';
import { BadgeCheck, Star, ThumbsUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAlong, type AlongRow } from '@/contexts/AlongContext';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { alongMeta } from '@/lib/alongCategories';
import { formatDistance } from '@/utils/geo';
import { fetchPlaceInfo, type PlaceInfo } from '@/services/geocodingService';
import { isOpenNow } from '@/utils/openingHours';
import { labelledIds, pinHtml } from '@/utils/alongPins';
import { aheadText, ListingLine, StopReviewButtons } from './AlongRouteSheet';

/** JalanGo's own "along the route" layer: one pin per place, tap for details. */
export function AlongMarkers() {
  const { map } = useMapContext();
  const { category, rows, select } = useAlong();
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; el: HTMLElement; key: string }>());
  const rowsRef = useRef<AlongRow[]>([]);
  rowsRef.current = rows ?? [];

  useEffect(() => {
    if (!map) return;
    const wanted = new Set<string>();
    if (category) {
      const meta = alongMeta(category);
      const labelled = labelledIds(rows ?? []);
      for (const r of rows ?? []) {
        if (r.ahead < -300) continue;
        wanted.add(r.place.id);
        const open = r.listing?.kind === 'food' ? isOpenNow(r.listing.details) : null;
        const label = labelled.has(r.place.id) ? { name: r.place.name, open } : null;
        const key = label ? `L${open}` : '-';
        const existing = markers.current.get(r.place.id);
        if (existing) {
          if (existing.key !== key) {
            existing.el.innerHTML = pinHtml(meta.color, meta.glyph, r.listing ? 'verified' : r.pick ? 'pick' : null, label);
            existing.key = key;
          }
          continue;
        }
        const el = document.createElement('button');
        el.type = 'button';
        el.style.position = 'relative';
        el.setAttribute('aria-label', `${meta.label}: ${r.place.name}`);
        el.innerHTML = pinHtml(meta.color, meta.glyph, r.listing ? 'verified' : r.pick ? 'pick' : null, label);
        const id = r.place.id;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = rowsRef.current.find((x) => x.place.id === id);
          if (row) select(row);
        });
        markers.current.set(id, { marker: new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([r.place.coordinates.lng, r.place.coordinates.lat]).addTo(map), el, key });
      }
    }
    markers.current.forEach((m, id) => {
      if (wanted.has(id)) return;
      m.marker.remove();
      markers.current.delete(id);
    });
  }, [map, category, rows, select]);

  useEffect(() => {
    const all = markers.current;
    return () => {
      all.forEach((m) => m.marker.remove());
      all.clear();
    };
  }, []);

  return null;
}

/** Card for a tapped pin. */
export function AlongPlaceCard() {
  const { selected, select, category } = useAlong();
  const { addStop, stop } = useRouting();
  const [info, setInfo] = useState<PlaceInfo | null | 'loading'>(null);
  const sel = selected?.place;
  const verified = Boolean(selected?.listing);
  useEffect(() => {
    setInfo(null);
    if (!sel || verified || sel.source === 'demo') return;
    const controller = new AbortController();
    setInfo('loading');
    fetchPlaceInfo(sel, controller.signal).then((i) => !controller.signal.aborted && setInfo(i));
    return () => controller.abort();
  }, [sel, verified]);
  if (!selected || !category) return null;
  const meta = alongMeta(category);
  const r = selected;
  return (
    <article aria-label={`Selected: ${r.place.name}`} className="glass pointer-events-auto animate-slide-up rounded-3xl p-4 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: r.pick ? '#10b981' : meta.color }}>
          <meta.icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold leading-tight">{r.place.name}</h2>
          {r.pick?.description ? (
            <p className="truncate text-sm italic text-ink-500">“{r.pick.description}”</p>
          ) : (
            r.place.address && <p className="truncate text-sm text-ink-500 dark:text-ink-300">{r.place.address}</p>
          )}
          <PlaceFacts r={r} info={info} />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
            <strong className="text-ink-800 dark:text-ink-100">{aheadText(r)}</strong>
            <span>{r.offset < 200 ? 'tepi jalan' : `${formatDistance(r.offset)} dari laluan`}</span>
            {r.pick && (
              <span className="flex items-center gap-0.5 text-jade-600">
                <ThumbsUp className="size-3" /> {r.pick.recommend_count}
              </span>
            )}
          </p>
        </div>
        <StopReviewButtons r={r} current={stop?.id === r.place.id} onStop={() => (addStop(r.place), select(null))} />
        <button type="button" onClick={() => select(null)} aria-label="Close" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800">
          <X className="size-4" />
        </button>
      </div>
    </article>
  );
}

/** ⭐ rating · Buka/Tutup: from the shop's own hours (checked by JalanGo) or Google. */
function PlaceFacts({ r, info }: { r: AlongRow; info: PlaceInfo | null | 'loading' }) {
  if (r.listing) {
    return (
      <>
        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-jade-700 dark:text-jade-300">
          <BadgeCheck className="size-3.5 shrink-0" /> Disemak JalanGo
        </p>
        <p className="truncate text-xs text-ink-500"><ListingLine l={r.listing} /></p>
      </>
    );
  }
  if (info === 'loading') return <p className="mt-0.5 h-4 w-28 animate-pulse rounded bg-ink-200 dark:bg-ink-700" aria-label="Memuatkan rating" />;
  if (!info || (info.rating === null && info.openNow === null)) return null;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
      {info.rating !== null && (
        <span className="flex items-center gap-0.5 font-semibold">
          <Star className="size-3.5 text-amber-500" fill="currentColor" /> {info.rating.toFixed(1)}
          {info.ratings ? <span className="font-normal text-ink-500">({info.ratings >= 1000 ? `${(info.ratings / 1000).toFixed(1)}k` : info.ratings})</span> : null}
        </span>
      )}
      {info.openNow !== null && <span className={info.openNow ? 'font-semibold text-jade-600' : 'font-semibold text-red-600'}>{info.openNow ? 'Buka sekarang' : 'Tutup sekarang'}</span>}
      <span className="text-[10px] text-ink-400" translate="no">Google</span>
    </p>
  );
}

/** "Makan di peta (12) ✕" chip while the layer is on. */
export function AlongLayerChip({ onOpen }: { onOpen: () => void }) {
  const { category, rows, setCategory } = useAlong();
  if (!category) return null;
  const meta = alongMeta(category);
  const n = rows?.filter((r) => r.ahead >= 0).length;
  return (
    <div role="status" className="pointer-events-auto flex w-fit max-w-full items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-xs font-semibold text-white shadow-float" style={{ background: meta.color }}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-1.5">
        <meta.icon className="size-4 shrink-0" />
        <span className="truncate">
          {meta.label} di peta{n !== undefined ? ` (${n})` : ''}
        </span>
      </button>
      <button type="button" onClick={() => setCategory(null)} aria-label="Buang dari peta" className="grid size-7 place-items-center rounded-full bg-white/20">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
