import { BadgeCheck, Loader2, MapPinPlus, Star, ThumbsUp, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useAlong, type AlongRow } from '@/contexts/AlongContext';
import { useRouting } from '@/contexts/RoutingContext';
import { ALONG_CATEGORIES, alongMeta } from '@/lib/alongCategories';
import { cn } from '@/lib/cn';
import { FOOD_TYPES, rm } from '@/lib/listingLabels';
import { isOpenNow } from '@/utils/openingHours';
import { formatDistance } from '@/utils/geo';
import { googleMapsReviewsUrl } from '@/utils/googleMapsLink';
import { FuelPriceCard } from '@/components/fuel/FuelPriceCard';

/** Food, cafés, attractions, R&R and fuel ahead on the current route, with "stop here". Results are also plotted on the map. */
export function AlongRouteSheet({ onClose }: { onClose: () => void }) {
  const { addStop, stop, clearStop, destination } = useRouting();
  const { category, setCategory, rows, error, live, announce, setAnnounce } = useAlong();
  useEffect(() => {
    if (!category) setCategory('food');
  }, [category, setCategory]);
  const meta = alongMeta(category ?? 'food');
  const verified = (rows ?? []).filter((r) => r.listing);
  const picks = (rows ?? []).filter((r) => r.pick).sort((a, b) => b.pick!.recommend_count - a.pick!.recommend_count);
  const others = (rows ?? []).filter((r) => !r.pick && !r.listing);
  const doStop = (r: AlongRow) => {
    addStop(r.place);
    onClose();
  };

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
      <div role="tablist" aria-label="Kategori" className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {ALONG_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold', category === c.id ? 'text-white' : 'bg-ink-100 dark:bg-ink-800')}
            style={category === c.id ? { background: c.color } : undefined}
          >
            <c.icon className="size-4" /> {c.label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-ink-500">
        <span>Ditanda di peta dengan pin {meta.label.toLowerCase()}.</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={announce}
            onClick={() => setAnnounce(!announce)}
            className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold', announce ? 'bg-jade-500/15 text-jade-700 dark:text-jade-300' : 'bg-ink-100 dark:bg-ink-800')}
          >
            {announce ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />} {announce ? 'Suara: on' : 'Suara: off'}
          </button>
          {category && (
            <button type="button" onClick={() => (setCategory(null), onClose())} className="rounded-full bg-ink-100 px-2.5 py-1 font-semibold dark:bg-ink-800">
              Buang dari peta
            </button>
          )}
        </div>
      </div>

      {category === 'petrol' && <FuelPriceCard className="mb-3" />}

      {!live ? (
        <p className="text-sm text-ink-500">Carian sepanjang laluan perlukan laluan sebenar dan sambungan internet.</p>
      ) : rows === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-ink-500">
          <Loader2 className="size-4 animate-spin" /> Mencari {meta.label.toLowerCase()} di depan…
        </p>
      ) : (
        <>
          {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
          {rows.length === 0 && !error && <p className="py-4 text-sm text-ink-500">Tiada {meta.label.toLowerCase()} dijumpai berhampiran laluan di depan.</p>}
          {verified.length > 0 && (
            <>
              <h3 className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-jade-600"><BadgeCheck className="size-3.5" /> Kedai disemak JalanGo</h3>
              <ul className="mb-3 divide-y divide-ink-100 dark:divide-ink-800">
                {verified.map((r) => (
                  <PlaceItem key={r.place.id} r={r} icon={meta.icon} color={meta.color} current={stop?.id === r.place.id} onStop={() => doStop(r)} />
                ))}
              </ul>
            </>
          )}
          {picks.length > 0 && (
            <>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-jade-600">Disyorkan pengguna JalanGo</h3>
              <ul className="mb-3 divide-y divide-ink-100 dark:divide-ink-800">
                {picks.map((r) => (
                  <PlaceItem key={r.place.id} r={r} icon={meta.icon} color={meta.color} current={stop?.id === r.place.id} onStop={() => doStop(r)} />
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              {(picks.length > 0 || verified.length > 0) && <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-500">Lain-lain di depan</h3>}
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {others.slice(0, 30).map((r) => (
                  <PlaceItem key={r.place.id} r={r} icon={meta.icon} color={meta.color} current={stop?.id === r.place.id} onStop={() => doStop(r)} />
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-xs text-ink-400">
            {verified.length > 0 && 'Kedai disemak JalanGo: IC dan premis peniaga telah disemak. '}Senarai tempat daripada Mapbox. Tekan ⭐ Review untuk baca review di Google Maps. 👍 = disyorkan pengguna JalanGo.{category === 'rnr' && ' Pastikan R&R berada di arah perjalanan anda.'}
          </p>
        </>
      )}
    </Sheet>
  );
}

export function aheadText(r: AlongRow): string {
  const where = r.ahead < 0 ? 'Baru lepas' : `${formatDistance(r.ahead)} lagi`;
  const side = r.side ? ` · ${r.side === 'left' ? 'kiri' : 'kanan'}` : '';
  return where + side;
}

function PlaceItem({ r, icon: Icon, color, current, onStop }: { r: AlongRow; icon: LucideIcon; color: string; current: boolean; onStop: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: r.pick || r.listing ? '#10b981' : color }}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{r.place.name}</p>
        {r.listing ? (
          <p className="truncate text-xs text-ink-500">
            <ListingLine l={r.listing} />
          </p>
        ) : r.pick?.description ? (
          <p className="truncate text-xs italic text-ink-500">“{r.pick.description}”</p>
        ) : (
          r.place.address && <p className="truncate text-xs text-ink-500">{r.place.address}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
          <strong className="text-ink-800 dark:text-ink-100">{aheadText(r)}</strong>
          <span>{r.offset < 200 ? 'tepi jalan' : `${formatDistance(r.offset)} dari laluan`}</span>
          {r.pick && (
            <span className="flex items-center gap-0.5 text-jade-600">
              <ThumbsUp className="size-3" /> {r.pick.recommend_count}
            </span>
          )}
        </p>
      </div>
      <StopReviewButtons r={r} current={current} onStop={onStop} />
    </li>
  );
}

/** "Warung · Buka sekarang · ± RM10" for a checked food business. */
function ListingLine({ l }: { l: NonNullable<AlongRow['listing']> }) {
  const open = isOpenNow(l.details);
  const type = FOOD_TYPES.find((x) => x.id === l.details.food_type)?.label;
  return <>{[type, open === true ? 'Buka sekarang' : open === false ? 'Tutup' : null, `± ${rm(l.price)}`].filter(Boolean).join(' · ')}</>;
}

export function StopReviewButtons({ r, current, onStop }: { r: AlongRow; current: boolean; onStop: () => void }) {
  return (
    <div className="flex shrink-0 flex-col items-stretch gap-1.5">
      <button
        type="button"
        onClick={onStop}
        disabled={current}
        className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:bg-violet-600/40"
        aria-label={`Singgah di ${r.place.name}`}
      >
        {current ? 'Dipilih' : 'Singgah'}
      </button>
      <a
        href={googleMapsReviewsUrl(r.place)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1 rounded-xl bg-ink-100 px-2 py-1.5 text-[11px] font-semibold text-ink-700 dark:bg-ink-800 dark:text-ink-200"
        aria-label={`Review Google untuk ${r.place.name}`}
      >
        <Star className="size-3 text-amber-500" fill="currentColor" /> Review
      </a>
    </div>
  );
}
