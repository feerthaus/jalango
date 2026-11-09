import { AlertTriangle, ArrowLeft, Coins, Megaphone, Gauge, LocateFixed, Navigation, RefreshCw, Route as RouteIcon, ShieldCheck, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { useReports } from '@/contexts/ReportsContext';
import { useRouting } from '@/contexts/RoutingContext';
import { ResumeToast } from './ResumeToast';
import { ShortcutSuggestions } from '@/components/shortcuts/ShortcutSuggestions';
import { reportsOnRoute } from '@/utils/routeAlerts';
import { buildRouteIndex } from '@/utils/routeProgress';
import { useMemo, useState } from 'react';
import { AlongRouteSheet } from '@/components/along/AlongRouteSheet';
import { useProbeConsent } from '@/hooks/useProbeConsent';
import { primeSpeech } from '@/hooks/useVoiceAlerts';
import { cn } from '@/lib/cn';
import type { Route } from '@/types';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { arrivalClock } from '@/utils/time';
import { useT } from '@/lib/i18n';

/** Route preview: alternatives, ETA, tolls, avoid-tolls and Start. */
export function RoutePanel() {
  const [t] = useT();
  const [alongOpen, setAlongOpen] = useState(false);
  const { status, destination, routes, selectedIndex, selectRoute, mode, notice, error, avoidTolls, setAvoidTolls, startNavigation, clearRoute, retry } = useRouting();
  if (!destination) return null;

  const { reports } = useReports();
  // community reports lying on each route option
  const reportCounts = useMemo(
    () => routes.map((r) => (reports.length && r.source !== 'demo' ? reportsOnRoute(buildRouteIndex(r), reports).length : 0)),
    [routes, reports],
  );
  const fastest = routes.reduce((min, r, i) => (r.durationSeconds < routes[min].durationSeconds ? i : min), 0);

  return (
    <section
      aria-label="Route options"
      className="glass pointer-events-auto flex max-h-[65dvh] animate-slide-up flex-col rounded-3xl shadow-float ring-1 ring-ink-900/5 md:max-h-[calc(100dvh-2rem)] dark:ring-white/10"
    >
      <header className="flex items-center gap-2 p-3 pb-2">
        <button type="button" onClick={clearRoute} aria-label="Close directions" className="grid size-10 place-items-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-500 dark:text-ink-400">{t('Dari lokasi anda ke', 'From your location to')}</p>
          <h2 className="truncate font-bold">{destination.name}</h2>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold hover:bg-ink-100 dark:hover:bg-ink-800">
          <input
            type="checkbox"
            checked={avoidTolls}
            onChange={(e) => setAvoidTolls(e.target.checked)}
            disabled={status === 'loading' || mode === 'demo'}
            className="size-4 accent-jade-500"
          />
          {t('Elak tol', 'Avoid tolls')}
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <ResumeToast className="mb-2" />
        {status === 'needs-location' && (
          <Message icon={LocateFixed} title={t('Menunggu lokasi anda', 'Waiting for your location')}>
            {t('Laluan bermula dari lokasi anda. Benarkan akses lokasi, atau ke kawasan terbuka untuk isyarat GPS.', 'Directions start from where you are. Allow location access, or move to an open area for a GPS fix.')}
          </Message>
        )}
        {status === 'loading' && (
          <ul aria-busy className="space-y-2 pb-2">
            {[0, 1].map((i) => (
              <li key={i} className="h-20 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800" />
            ))}
          </ul>
        )}
        {status === 'error' && (
          <Message icon={AlertTriangle} title={t('Tak dapat kira laluan', 'Couldn’t calculate a route')}>
            <p>{error}</p>
            <Button variant="secondary" className="mt-3" onClick={retry}>
              <RefreshCw className="size-4" /> {t('Cuba lagi', 'Try again')}
            </Button>
          </Message>
        )}
        {status === 'ready' && (
          <>
            {mode === 'demo' && (
              <div className="mb-2 flex items-start gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                <DemoBadge label="Demo" className="shrink-0" />
                <span>{notice ?? t('Laluan jalan tidak tersedia, jadi ini garis lurus, bukan jalan sebenar. Masa ialah anggaran kasar pada 50 km/j.', 'Routing isn’t connected, so this is a straight line, not a road route. The time is a rough estimate at 50 km/h.')}</span>
              </div>
            )}
            <ShortcutSuggestions />
            <ul role="radiogroup" aria-label="Routes" className="space-y-2 pb-2">
              {routes.map((r, i) => (
                <RouteOption key={r.id} route={r} reportCount={reportCounts[i] ?? 0} selected={i === selectedIndex} fastest={routes.length > 1 && i === fastest} onSelect={() => selectRoute(i)} />
              ))}
            </ul>
          </>
        )}
      </div>

      {status === 'ready' && (
        <footer className="space-y-2 p-3 pt-1">
          <ProbeConsentPrompt />
          <Button variant="secondary" className="w-full" onClick={() => setAlongOpen(true)}>
            <Utensils className="size-4" /> {t('Tempat makan & menarik sepanjang laluan', 'Food & sights along the route')}
          </Button>
          <Button
            className="w-full py-3 text-base"
            onClick={() => {
              primeSpeech();
              startNavigation();
            }}
          >
            <Navigation className="size-5" fill="currentColor" /> {t('Mula', 'Start')}
          </Button>
        </footer>
      )}
      {alongOpen && <AlongRouteSheet onClose={() => setAlongOpen(false)} />}
    </section>
  );
}

function RouteOption({ route, reportCount, selected, fastest, onSelect }: { route: Route; reportCount: number; selected: boolean; fastest: boolean; onSelect: () => void }) {
  const [t] = useT();
  const delay = route.typicalDurationSeconds ? route.durationSeconds - route.typicalDurationSeconds : 0;
  const heavy = delay > 300;
  const demo = route.source === 'demo';
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cn(
          'w-full rounded-2xl p-3 text-left ring-2 transition',
          selected ? 'bg-jade-500/10 ring-jade-500' : 'bg-white ring-transparent hover:ring-ink-200 dark:bg-ink-800 dark:hover:ring-ink-700',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn('text-xl font-black tabular-nums', heavy ? 'text-red-500' : delay > 120 ? 'text-amber-500' : '')}>
            {demo && '~'}
            {formatDuration(route.durationSeconds)}
          </span>
          <span className="text-sm text-ink-500 dark:text-ink-300">
            {formatDistance(route.distanceMeters)} · arrive {arrivalClock(route.durationSeconds)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-600 dark:text-ink-300">{route.summary ? `${t('melalui', 'via')} ${route.summary}` : t('Laluan', 'Route')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fastest && <Chip className="bg-jade-500/15 text-jade-700 dark:text-jade-300">{t('Terpantas', 'Fastest')}</Chip>}
          {route.hasTolls && (
            <Chip className="bg-amber-400/15 text-amber-700 dark:text-amber-300">
              <Coins className="size-3" /> {t('Bertol', 'Toll road')}
            </Chip>
          )}
          {route.hasMotorway && (
            <Chip className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <RouteIcon className="size-3" /> {t('Lebuh raya', 'Highway')}
            </Chip>
          )}
          {reportCount > 0 && (
            <Chip className="bg-red-500/15 text-red-600 dark:text-red-300">
              <Megaphone className="size-3" /> {reportCount} {t('laporan di laluan', reportCount === 1 ? 'report on route' : 'reports on route')}
            </Chip>
          )}
          {delay > 120 && (
            <Chip className={heavy ? 'bg-red-500/15 text-red-600 dark:text-red-300' : 'bg-amber-400/15 text-amber-700 dark:text-amber-300'}>
              <Gauge className="size-3" /> +{formatDuration(delay)} {t('trafik', 'traffic')}
            </Chip>
          )}
        </div>
      </button>
    </li>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>;
}

function Message({ icon: Icon, title, children }: { icon: typeof AlertTriangle; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-ink-800">
      <Icon className="mt-0.5 size-5 shrink-0 text-amber-500" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="text-ink-500 dark:text-ink-300">{children}</div>
      </div>
    </div>
  );
}

/** One-time opt-in for anonymous traffic data. Default is off. */
function ProbeConsentPrompt() {
  const [t] = useT();
  const [consent, setConsent] = useProbeConsent();
  if (consent !== null) return null;
  return (
    <div className="rounded-2xl bg-ink-100 p-3 text-xs dark:bg-ink-800">
      <p className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-jade-500" />
        <span>
          <strong className="font-semibold">{t('Bantu bina data trafik JalanGo?', 'Help build JalanGo traffic?')}</strong>{' '}
          {t('Semasa navigasi, kongsi kelajuan dan kedudukan anda tanpa nama. Tiada akaun dikaitkan, dan tiada apa-apa berhampiran titik mula atau destinasi dihantar. Boleh ditukar di Profil.', 'While you navigate, share your speed and position anonymously. No account is linked, and nothing near your start or destination is sent. You can change this in Profile.')}{' '}
          <a href="/privacy#s2" className="underline">{t('Butiran', 'Details')}</a>
        </span>
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setConsent('denied')}>
          {t('Tak mengapa', 'No thanks')}
        </Button>
        <Button className="px-3 py-1.5 text-xs" onClick={() => setConsent('granted')}>
          {t('Kongsi tanpa nama', 'Share anonymously')}
        </Button>
      </div>
    </div>
  );
}
