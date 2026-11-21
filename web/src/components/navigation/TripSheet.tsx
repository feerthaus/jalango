import { ChevronDown, Coins, Flag, ListOrdered, Map as MapIcon, Megaphone, Navigation, Radio, Route as RouteIcon, Search, Volume2, VolumeX, X } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CONGESTION_COLORS, ROUTE_BLUE } from '@/components/map/RouteLayer';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useAlong } from '@/contexts/AlongContext';
import { useMapContext } from '@/contexts/MapContext';
import { useReports } from '@/contexts/ReportsContext';
import { useRouting } from '@/contexts/RoutingContext';
import { ALONG_CATEGORIES } from '@/lib/alongCategories';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { reportMeta, reportTitle } from '@/lib/reportTypes';
import { useMyVehicle } from '@/lib/vehicle';
import type { AlongCategory } from '@/services/geocodingService';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { reportsOnRoute } from '@/utils/routeAlerts';
import { buildRouteIndex, routeSegment } from '@/utils/routeProgress';
import { clusterMarkers, routeStrip } from '@/utils/routeStrip';
import { arrivalClock } from '@/utils/time';
import { tollEstimate } from '@/utils/tripCost';

/** Stops offered in the sheet (the full list is in the along-route sheet) */
const QUICK_STOPS: AlongCategory[] = ['petrol', 'food', 'rnr', 'cafe'];
const SWIPE_PX = 30;

interface Props {
  remainingSeconds: number;
  remainingMeters: number;
  demo: boolean;
  showSteps: boolean;
  onToggleSteps: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  onShare: () => void;
  onAlong: () => void;
}

/**
 * The trip bar at the bottom while driving. Swipe it up (or tap the time) for
 * the whole trip, like Waze: arrival time, the route it takes and its toll,
 * the road ahead on one line with traffic, reports and toll plazas, quick
 * stops on the way, share, route overview and end. Swipe down to close.
 */
export function TripSheet({ remainingSeconds, remainingMeters, demo, showSteps, onToggleSteps, voiceOn, onToggleVoice, onShare, onAlong }: Props) {
  const [t, lang] = useT();
  const { selectedRoute: route, destination, progress, endNavigation } = useRouting();
  const { map, setFollowing } = useMapContext();
  const { reports } = useReports();
  const { setCategory } = useAlong();
  const [vehicle] = useMyVehicle();
  const [open, setOpen] = useState(false);
  const drag = useRef<number | null>(null);

  const index = useMemo(() => (route ? buildRouteIndex(route) : null), [route]);
  const onRoute = useMemo(() => (open && index ? reportsOnRoute(index, reports) : []), [open, index, reports]);
  // Recomputed every ~50 m driven while open (not for every GPS fix)
  const along = progress ? Math.floor(progress.along / 50) * 50 : 0;
  const strip = useMemo(() => (open && route && index ? routeStrip(route, index, along, onRoute) : null), [open, route, index, along, onRoute]);
  const toll = route ? tollEstimate(route, vehicle) : null;
  const reportsAhead = strip ? strip.markers.filter((m) => m.kind === 'report').length : 0;

  // Swipe up to open, down to close. Touch events, not pointer events: on phones
  // the browser cancels a pointer gesture once it decides the finger is
  // scrolling the sheet, but a touch always ends with touchend.
  const swipe = useRef<{ y: number; atTop: boolean } | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const decide = (dy: number, atTop: boolean) => {
    if (!open && dy < -SWIPE_PX) setOpen(true);
    // closing from the list only when it's scrolled to the top (otherwise it's a scroll)
    else if (open && dy > SWIPE_PX && atTop) setOpen(false);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    // From the handle or the bar it always counts; from the list only at its top
    const inList = content.current?.contains(e.target as Node) ?? false;
    swipe.current = { y: e.touches[0].clientY, atTop: !inList || (content.current?.scrollTop ?? 0) <= 0 };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !e.changedTouches[0]) return;
    decide(e.changedTouches[0].clientY - s.y, s.atTop);
  };
  // Mouse (desktop): the same with pointer events
  const onMouseDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') drag.current = e.clientY;
  };
  const onMouseUp = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse' || drag.current === null) return;
    const dy = e.clientY - drag.current;
    drag.current = null;
    decide(dy, !(content.current?.contains(e.target as Node) ?? false) || (content.current?.scrollTop ?? 0) <= 0);
  };

  const overview = () => {
    if (!map || !index) return;
    const rest = routeSegment(index, progress?.along ?? 0, index.total);
    if (rest.length < 2) return;
    let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lng, lat] of rest) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    setFollowing(false); // "Tengah" brings the driving view back
    const { clientWidth: w } = map.getContainer();
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: { top: 220, bottom: 140, left: w >= 768 ? 460 : 40, right: 40 }, pitch: 0, bearing: 0, maxZoom: 16, duration: 900 },
    );
    setOpen(false);
  };

  const stopAt = (c: AlongCategory) => {
    setCategory(c);
    onAlong();
    setOpen(false);
  };

  return (
    <div
      className="glass pointer-events-auto rounded-3xl shadow-float ring-1 ring-ink-900/5 dark:ring-white/10"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => (swipe.current = null)}
      onPointerDown={onMouseDown}
      onPointerUp={onMouseUp}
      onKeyDown={(e) => e.key === 'Escape' && open && setOpen(false)}
    >
      {/* Grab handle: swipe up / down, or tap */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="trip-sheet"
        aria-label={open ? t('Tutup butiran perjalanan', 'Close trip details') : t('Buka butiran perjalanan', 'Open trip details')}
        className="flex w-full touch-none flex-col items-center pb-0.5 pt-2"
      >
        <span className="h-1.5 w-10 rounded-full bg-ink-300 dark:bg-ink-600" />
        {/* open: a clear "tap or pull down to close" */}
        {open && <ChevronDown className="-mb-1 size-5 text-ink-400" aria-hidden />}
      </button>

      {open && (
        <div id="trip-sheet" ref={content} className="max-h-[min(60dvh,520px)] space-y-4 overflow-y-auto overscroll-contain border-b border-ink-900/5 px-4 pb-4 pt-1 dark:border-white/10 short:max-h-[55dvh]">
          {/* Arrival: JalanGo's trip header (same type scale as the route options) */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Tiba', 'Arrive')}</p>
              <p className="text-3xl font-black tabular-nums leading-none text-jade-600 dark:text-jade-400">{arrivalClock(remainingSeconds)}</p>
            </div>
            <p className="pb-0.5 text-right text-sm text-ink-500 dark:text-ink-300">
              <span className="block font-bold tabular-nums text-ink-900 dark:text-white">
                {demo && '~'}
                {formatDuration(remainingSeconds)}
              </span>
              {formatDistance(remainingMeters)}
            </p>
          </div>

          {/* Where and how: a JalanGo route card */}
          <div className="rounded-2xl bg-white p-3 dark:bg-ink-800">
            {destination && (
              <p className="flex min-w-0 items-center gap-1.5 font-bold">
                <Flag className="size-4 shrink-0 text-red-600" />
                <span className="truncate">{destination.name}</span>
              </p>
            )}
            {route?.summary && <p className="mt-0.5 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{t(`melalui ${route.summary}`, `via ${route.summary}`)}</p>}
            {(toll || route?.hasMotorway || reportsAhead > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {toll && (
                  <Chip className="bg-amber-400/15 text-amber-700 dark:text-amber-300">
                    <Coins className="size-3" /> {toll.min === toll.max ? t(`Tol RM${toll.min.toFixed(2)}`, `Toll RM${toll.min.toFixed(2)}`) : t(`Tol ~RM${toll.min}–${toll.max}`, `Toll ~RM${toll.min}–${toll.max}`)}
                  </Chip>
                )}
                {route?.hasMotorway && (
                  <Chip className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                    <RouteIcon className="size-3" /> {t('Lebuh raya', 'Highway')}
                  </Chip>
                )}
                {reportsAhead > 0 && (
                  <Chip className="bg-red-500/15 text-red-600 dark:text-red-300">
                    <Megaphone className="size-3" /> {reportsAhead} {t('laporan di depan', reportsAhead === 1 ? 'report ahead' : 'reports ahead')}
                  </Chip>
                )}
              </div>
            )}
            {strip && <RouteStripView strip={strip} lang={lang} />}
          </div>

          {/* Stops on the way: the same category chips as "Sepanjang laluan" */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Singgah di laluan', 'Stop on the way')}</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {QUICK_STOPS.map((id) => {
                const c = ALONG_CATEGORIES.find((x) => x.id === id)!;
                return (
                  <button key={id} type="button" onClick={() => stopAt(id)} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white" style={{ background: c.color }}>
                    <c.icon className="size-4" /> {t(c.label)}
                  </button>
                );
              })}
              <button type="button" onClick={() => { onAlong(); setOpen(false); }} className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink-100 px-3 py-2 text-sm font-semibold dark:bg-ink-800">
                <Search className="size-4" /> {t('Lagi', 'More')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="whitespace-nowrap px-2 py-2.5 text-sm" onClick={() => { onShare(); setOpen(false); }}>
              <Radio className="size-4" /> {t('Kongsi', 'Share drive')}
            </Button>
            <Button variant="secondary" className="whitespace-nowrap px-2 py-2.5 text-sm" onClick={overview}>
              <MapIcon className="size-4" /> {t('Seluruh laluan', 'Overview')}
            </Button>
          </div>
        </div>
      )}

      {/* The bar itself: open → End / Resume; closed → time and quick buttons */}
      {open ? (
        <div className="grid touch-none grid-cols-[auto_1fr] gap-2 p-3 short:p-2">
          <Button variant="danger" className="px-5 py-3" onClick={endNavigation}>
            <X className="size-4" /> {t('Tamat', 'End')}
          </Button>
          <Button className="py-3" onClick={() => setOpen(false)}>
            <Navigation className="size-4" /> {t('Teruskan', 'Resume')}
          </Button>
        </div>
      ) : (
        <div className="flex touch-none items-center gap-2 p-3 pl-4 pt-1 short:py-1.5">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 overflow-hidden text-left" aria-label={t('Butiran perjalanan', 'Trip details')}>
            <p className="whitespace-nowrap text-xl font-black tabular-nums leading-tight text-jade-600 min-[400px]:text-2xl dark:text-jade-400">
              {demo && '~'}
              {formatDuration(remainingSeconds)}
            </p>
            <p className="whitespace-nowrap text-sm text-ink-500 dark:text-ink-300">
              {formatDistance(remainingMeters)} · {arrivalClock(remainingSeconds)}
            </p>
          </button>
          <IconButton label={t('Kongsi lokasi live', 'Share live location')} onClick={onShare}>
            <Radio className="size-5 text-jade-600 dark:text-jade-400" />
          </IconButton>
          <IconButton label={voiceOn ? t('Senyapkan panduan suara', 'Mute voice guidance') : t('Hidupkan panduan suara', 'Unmute voice guidance')} onClick={onToggleVoice}>
            {voiceOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-ink-400" />}
          </IconButton>
          <IconButton label={showSteps ? t('Sembunyi senarai arahan', 'Hide directions list') : t('Tunjuk senarai arahan', 'Show directions list')} active={showSteps} onClick={onToggleSteps}>
            <ListOrdered className="size-5" />
          </IconButton>
          <Button variant="danger" className="h-11 shrink-0 px-3" onClick={endNavigation} aria-label={t('Tamatkan navigasi', 'End navigation')}>
            <X className="size-5 min-[420px]:size-4 short:size-5" /> <span className="hidden min-[420px]:inline short:hidden">{t('Tamat', 'End')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/** You → destination on one line: slow traffic, reports and toll plazas where they are. */
function RouteStripView({ strip, lang }: { strip: ReturnType<typeof routeStrip>; lang: 'ms' | 'en' }) {
  const [t] = useT();
  const reports = strip.markers.filter((m) => m.kind === 'report').length;
  const tolls = strip.markers.filter((m) => m.kind === 'toll').length;
  return (
    <div>
      <div className="relative mx-2 mt-3 h-11" role="img" aria-label={t(`Laluan di depan: ${reports} laporan, ${tolls} plaza tol`, `Road ahead: ${reports} reports, ${tolls} toll plazas`)}>
        <div className="absolute inset-x-0 bottom-2 h-1.5 overflow-hidden rounded-full" style={{ background: ROUTE_BLUE }}>
          {strip.runs.map((r, i) => (
            <span key={i} className="absolute inset-y-0" style={{ left: `${r.from * 100}%`, width: `${Math.max(0.6, (r.to - r.from) * 100)}%`, background: CONGESTION_COLORS[r.congestion] }} />
          ))}
        </div>
        <Navigation className="absolute -left-2 bottom-0.5 size-4 rotate-45 fill-current text-[#2f7bff]" aria-hidden />
        <Flag className="absolute -right-2 bottom-1 size-4 text-red-600" aria-hidden />
        {clusterMarkers(strip.markers).map(({ marker: m, more }, i) => {
          if (m.kind === 'toll') {
            return (
              <span key={`t${i}`} title={m.name} className="absolute bottom-5 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-ink-700 text-white ring-2 ring-white dark:ring-ink-900" style={{ left: `${m.pos * 100}%` }}>
                <Coins className="size-3.5" />
                <More n={more} />
              </span>
            );
          }
          const meta = reportMeta(m.report.report_type);
          return (
            <span key={m.report.id} title={reportTitle(m.report, lang)} className={cn('absolute bottom-5 grid size-7 -translate-x-1/2 place-items-center rounded-full ring-2 ring-white dark:ring-ink-900', meta.tone)} style={{ left: `${m.pos * 100}%` }}>
              <meta.icon className="size-4" />
              <More n={more} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function More({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="absolute -right-2 -top-1.5 rounded-full bg-ink-950 px-1 text-[10px] font-bold leading-4 text-white">+{n}</span>;
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>;
}
