import { ChevronDown, ChevronUp, Flag, ListOrdered, LocateFixed, Loader2, Volume2, VolumeX, X } from 'lucide-react';
import { useRouteAlerts } from '@/hooks/useRouteAlerts';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { ResumeToast } from './ResumeToast';
import { RouteAlerts } from './RouteAlerts';
import { OncomingBanner } from './OncomingBanner';
import { useOncomingAlerts } from '@/hooks/useOncomingAlerts';
import { LiveShareBanner } from '@/components/live/LiveShareBanner';
import { ConvoyBanner } from '@/components/convoy/ConvoyBanner';
import { ShareLiveSheet } from '@/components/live/ShareLiveSheet';
import { Radio } from 'lucide-react';
import { RateTrip } from '@/components/trips/RateTrip';
import { useTrips } from '@/contexts/TripsContext';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/DemoBadge';
import { IconButton } from '@/components/ui/IconButton';
import { useMapContext } from '@/contexts/MapContext';
import { useRouting } from '@/contexts/RoutingContext';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/utils/format';
import { formatDistance } from '@/utils/geo';
import { arrivalClock } from '@/utils/time';
import { ManeuverIcon } from './ManeuverIcon';

/** Turn-by-turn banner (top) and trip bar (bottom) while navigating. */
export function NavigationHud() {
  const { status, selectedRoute: route, progress, destination, endNavigation, rerouting, finishedTripId } = useRouting();
  const { getTrip } = useTrips();
  const finishedTrip = finishedTripId ? getTrip(finishedTripId) : undefined;
  const { following, setFollowing } = useMapContext();
  const [showSteps, setShowSteps] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const alerts = useRouteAlerts();
  useWakeLock(status === 'navigating');
  useVoiceGuidance();
  const oncoming = useOncomingAlerts();
  const [voiceOn, setVoiceOn] = useVoiceAlerts();
  if (!route || !destination) return null;

  if (status === 'arrived') {
    return (
      <div className="absolute inset-x-0 bottom-0 z-30 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem+var(--host-badge-h))] md:w-[420px] md:p-4">
        <div className="glass pointer-events-auto animate-slide-up rounded-3xl p-5 text-center shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
          <span className="mx-auto mb-2 grid size-14 place-items-center rounded-full bg-jade-500 text-ink-950">
            <Flag className="size-7" />
          </span>
          <h2 className="text-xl font-bold">You’ve arrived</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">{destination.name}</p>
          {finishedTrip && (
            <div className="mt-4 border-t border-ink-100 pt-4 dark:border-ink-800">
              <p className="mb-2 text-sm font-semibold">How was this trip?</p>
              <RateTrip trip={finishedTrip} compact />
            </div>
          )}
          <Button variant={finishedTrip?.rating ? 'primary' : 'secondary'} className="mt-4 w-full py-3" onClick={endNavigation}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  const stepIndex = progress?.stepIndex ?? 0;
  const next = route.steps[stepIndex + 1] ?? route.steps[stepIndex];
  const after = route.steps[stepIndex + 2];
  const remainingSeconds = progress?.remainingSeconds ?? route.durationSeconds;
  const remainingMeters = progress?.remainingMeters ?? route.distanceMeters;
  const demo = route.source === 'demo';
  const road = next.roadRef && next.roadName ? `${next.roadRef} · ${next.roadName}` : (next.roadRef ?? next.roadName);

  return (
    <>
      {/* Maneuver banner */}
      <div className="absolute inset-x-0 top-0 z-30 space-y-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:w-[420px] md:p-4">
        <div className="pointer-events-auto overflow-hidden rounded-3xl bg-ink-950 text-white shadow-float">
          <button type="button" onClick={() => setShowSteps((s) => !s)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={showSteps} aria-controls="nav-steps">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-jade-500 text-ink-950">
              <ManeuverIcon step={next} className="size-9" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-3xl font-black tabular-nums leading-none">{progress ? formatDistance(progress.distanceToManeuver) : '–'}</span>
              <span className="mt-1 block truncate text-base font-semibold">{next.instruction}</span>
              {road && <span className="mt-0.5 block truncate text-sm text-ink-300">{road}</span>}
            </span>
            {showSteps ? <ChevronUp className="size-5 text-ink-300" /> : <ChevronDown className="size-5 text-ink-300" />}
          </button>
          {after && !showSteps && (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-sm text-ink-300">
              Then <ManeuverIcon step={after} className="size-4 text-white" />
              <span className="truncate">{after.instruction}</span>
            </div>
          )}
          {rerouting && (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-sm text-amber-300">
              <Loader2 className="size-4 animate-spin" /> Finding a new route…
            </div>
          )}
          {demo && (
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-xs text-ink-300">
              <DemoBadge label="Demo" /> Straight-line guidance only — follow road signs.
            </div>
          )}
          {showSteps && (
            <ol id="nav-steps" aria-label="Turn-by-turn directions" className="max-h-[45dvh] overflow-y-auto border-t border-white/10 py-1">
              {route.steps.map((s, i) => (
                <li key={i} className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', i <= stepIndex ? 'opacity-40' : i === stepIndex + 1 && 'bg-white/5')}>
                  <ManeuverIcon step={s} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{s.instruction}</span>
                    {(s.roadRef || s.roadName) && <span className="block truncate text-xs text-ink-400">{s.roadRef ? `${s.roadRef} ${s.roadName ?? ''}` : s.roadName}</span>}
                  </span>
                  {s.distanceMeters > 0 && <span className="shrink-0 text-xs tabular-nums text-ink-400">{formatDistance(s.distanceMeters)}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
        {oncoming && <OncomingBanner threat={oncoming} />}
        {!showSteps && <LiveShareBanner />}
        {!showSteps && <ConvoyBanner />}
        {!showSteps && <ResumeToast />}
        {!showSteps && <RouteAlerts alerts={alerts} />}
      </div>

      {/* Trip bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 space-y-3 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem+var(--host-badge-h))] md:w-[420px] md:p-4">
        {!following && (
          <IconButton label="Re-centre" onClick={() => setFollowing(true)} className="!w-auto gap-2 px-4 text-sm font-semibold">
            <LocateFixed className="size-5" /> Re-centre
          </IconButton>
        )}
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-3xl p-3 pl-5 shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-black tabular-nums leading-tight text-jade-600 dark:text-jade-400">
              {demo && '~'}
              {formatDuration(remainingSeconds)}
            </p>
            <p className="text-sm text-ink-500 dark:text-ink-300">
              {formatDistance(remainingMeters)} · {arrivalClock(remainingSeconds)}
            </p>
          </div>
          <IconButton label="Share live location" onClick={() => setShareOpen(true)}>
            <Radio className="size-5 text-jade-600 dark:text-jade-400" />
          </IconButton>
          <IconButton label={voiceOn ? 'Mute voice guidance' : 'Unmute voice guidance'} onClick={() => setVoiceOn(!voiceOn)}>
            {voiceOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-ink-400" />}
          </IconButton>
          <IconButton label={showSteps ? 'Hide directions list' : 'Show directions list'} active={showSteps} onClick={() => setShowSteps((s) => !s)}>
            <ListOrdered className="size-5" />
          </IconButton>
          <Button variant="danger" className="h-11 px-4" onClick={endNavigation} aria-label="End navigation">
            <X className="size-4" /> End
          </Button>
        </div>
      </div>
      {shareOpen && <ShareLiveSheet onClose={() => setShareOpen(false)} />}
    </>
  );
}
