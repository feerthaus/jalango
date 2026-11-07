import mapboxgl from 'mapbox-gl';
import { ThumbsUp, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAlong, type AlongRow } from '@/contexts/AlongContext';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { alongMeta } from '@/lib/alongCategories';
import { formatDistance } from '@/utils/geo';
import { aheadText, StopReviewButtons } from './AlongRouteSheet';

function pinHtml(color: string, glyph: string, pick: boolean): string {
  const bg = pick ? '#10b981' : color;
  return `
    <div style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:${bg};border:2.5px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .4)">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </div>
    ${pick ? '<span style="position:absolute;top:-5px;right:-6px;font-size:12px">⭐</span>' : ''}`;
}

/** JalanGo's own "along the route" layer: one pin per place, tap for details. */
export function AlongMarkers() {
  const { map } = useMapContext();
  const { category, rows, select } = useAlong();
  const markers = useRef(new Map<string, mapboxgl.Marker>());
  const rowsRef = useRef<AlongRow[]>([]);
  rowsRef.current = rows ?? [];

  useEffect(() => {
    if (!map) return;
    const wanted = new Set<string>();
    if (category) {
      const meta = alongMeta(category);
      for (const r of rows ?? []) {
        if (r.ahead < -300) continue;
        wanted.add(r.place.id);
        if (markers.current.has(r.place.id)) continue;
        const el = document.createElement('button');
        el.type = 'button';
        el.style.position = 'relative';
        el.setAttribute('aria-label', `${meta.label}: ${r.place.name}`);
        el.innerHTML = pinHtml(meta.color, meta.glyph, Boolean(r.pick));
        const id = r.place.id;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const row = rowsRef.current.find((x) => x.place.id === id);
          if (row) select(row);
        });
        markers.current.set(id, new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([r.place.coordinates.lng, r.place.coordinates.lat]).addTo(map));
      }
    }
    markers.current.forEach((m, id) => {
      if (wanted.has(id)) return;
      m.remove();
      markers.current.delete(id);
    });
  }, [map, category, rows, select]);

  useEffect(() => {
    const all = markers.current;
    return () => {
      all.forEach((m) => m.remove());
      all.clear();
    };
  }, []);

  return null;
}

/** Card for a tapped pin. */
export function AlongPlaceCard() {
  const { selected, select, category } = useAlong();
  const { addStop, stop } = useRouting();
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
