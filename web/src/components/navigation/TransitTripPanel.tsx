import { BellRing, Car, CheckCircle2, Flag, Footprints, MapPin, Satellite, TrainFront, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLocation } from '@/contexts/LocationContext';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { disarm, ring, stopRinging } from '@/lib/arrivalAlarm';
import { endTransitTrip, updateTransitProgress, useTransitTrip } from '@/lib/transitTrip';
import { advanceTrip, tripSteps, type TripStep } from '@/utils/transitProgress';
import { LineBadge } from './TransitOptions';

const clock = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().slice(11, 16);
const TICK_MS = 5_000;

/**
 * Following a public transport trip: the step you are on, stops left, and an
 * alarm one stop before you get off. Works from GPS above ground and from the
 * timetable underground. The person can tap any step to correct it.
 */
export function TransitTripPanel() {
  const [t] = useT();
  const trip = useTransitTrip();
  const { fix } = useLocation();
  const steps = useMemo(() => (trip ? tripSteps(trip.option) : []), [trip?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(() => Date.now());
  const [alarm, setAlarm] = useState<number | null>(null);
  const [tick, setTick] = useState<{ stopsLeft: number | null; byGps: boolean }>({ stopsLeft: null, byGps: false });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Move along on every new location and every few seconds (timetable)
  useEffect(() => {
    if (!trip) return;
    const r = advanceTrip(steps, trip.progress, fix ? { coordinates: fix.coordinates, accuracy: fix.accuracy } : null, now, trip.to);
    setTick({ stopsLeft: r.stopsLeft, byGps: r.byGps });
    if (r.alert !== null) {
      setAlarm(r.alert);
      ring(20_000);
    }
    updateTransitProgress(r.progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, now, steps]);

  // Leaving the trip: stop sounds and let the screen sleep again
  useEffect(() => () => disarm(), []);

  // Keep the current step in view in the list
  const currentRef = useRef<HTMLLIElement | null>(null);
  const stepNow = trip?.progress.step;
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [stepNow]);

  if (!trip) return null;
  const { progress } = trip;
  const current = steps[progress.step];
  const alarmStep = alarm !== null ? steps[alarm] : null;
  const nextAfter = (i: number) => steps[i + 1];

  const pick = (i: number) => {
    stopRinging();
    setAlarm(null);
    // picking a step by hand: keep earlier warnings, forget later ones
    updateTransitProgress({ step: i, alerted: progress.alerted.filter((a) => a < i), done: false });
  };
  const end = () => {
    stopRinging();
    disarm();
    endTransitTrip();
  };

  return (
    <section aria-label={t('Perjalanan awam', 'Transit trip')} className="glass pointer-events-auto flex max-h-[55dvh] flex-col rounded-3xl shadow-float ring-1 ring-ink-900/5 dark:ring-white/10">
      <header className="flex items-center gap-2 p-3 pb-2">
        <TrainFront className="size-5 shrink-0 text-jade-600 dark:text-jade-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-500 dark:text-ink-400">{t('Perjalanan awam ke', 'Transit to')}</p>
          <h2 className="truncate font-bold">{trip.destinationName}</h2>
        </div>
        <span className="text-right text-xs text-ink-500">
          {t('tiba', 'arrive')} <strong className="block text-base tabular-nums text-ink-900 dark:text-white">{clock(Date.parse(trip.option.arrive))}</strong>
        </span>
        <button type="button" onClick={end} aria-label={t('Tamatkan perjalanan', 'End trip')} className="grid size-10 place-items-center rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800">
          <X className="size-5" />
        </button>
      </header>

      {alarmStep?.kind === 'ride' && (
        <div role="alert" className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-amber-400 p-3 text-ink-950">
          <BellRing className="size-7 shrink-0 animate-pulse" />
          <div className="min-w-0 flex-1">
            <p className="font-black">{t(`Turun di stesen seterusnya: ${alarmStep.leg.to.name}`, `Get off at the next stop: ${alarmStep.leg.to.name}`)}</p>
            <p className="text-sm">
              {(() => {
                const n = nextAfter(alarm!);
                if (n?.kind === 'ride') return t(`Tukar ke ${n.leg.routeName}`, `Change to ${n.leg.routeName}`);
                if (n?.kind === 'walk') return t(`Jalan kaki ke ${n.walk.to.name} untuk tukar laluan`, `Walk to ${n.walk.to.name} to change lines`);
                return t('Ini perhentian terakhir anda', 'This is your last stop');
              })()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopRinging();
              setAlarm(null);
            }}
            className="rounded-xl bg-ink-950 px-3 py-2 text-sm font-bold text-white"
          >
            {t('OK', 'OK')}
          </button>
        </div>
      )}

      {progress.done ? (
        <div className="m-3 mt-0 flex items-center gap-3 rounded-2xl bg-jade-500/10 p-3">
          <CheckCircle2 className="size-7 text-jade-600" />
          <p className="flex-1 font-bold">{t('Anda dah sampai. Selamat!', 'You’ve arrived. Enjoy!')}</p>
          <Button onClick={end}>{t('Tutup', 'Close')}</Button>
        </div>
      ) : (
        current && <NowCard step={current} stopsLeft={tick.stopsLeft} byGps={tick.byGps} now={now} />
      )}

      <ol aria-label={t('Langkah perjalanan', 'Trip steps')} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {steps.map((s, i) => (
          <li key={i} ref={i === progress.step ? currentRef : undefined}>
            <button
              type="button"
              onClick={() => pick(i)}
              aria-current={i === progress.step ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm',
                i === progress.step && !progress.done ? 'bg-jade-500/15 font-semibold' : i < progress.step || progress.done ? 'text-ink-400' : 'hover:bg-ink-100 dark:hover:bg-ink-800',
              )}
            >
              <StepIcon step={s} />
              <span className="min-w-0 flex-1">
                <StepText step={s} />
              </span>
              <span className="shrink-0 tabular-nums text-xs text-ink-500">{clock(s.startMs)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="px-3 pb-3 text-[11px] leading-snug text-ink-400">
        {t('Biarkan JalanGo terbuka: amaran berbunyi satu stesen sebelum anda turun. Dalam terowong, kedudukan dianggar ikut jadual. Tekan mana-mana langkah untuk betulkan.', 'Keep JalanGo open: the alarm rings one stop before you get off. In tunnels, your position is estimated from the timetable. Tap any step to correct it.')}
      </p>
    </section>
  );
}

function NowCard({ step, stopsLeft, byGps, now }: { step: TripStep; stopsLeft: number | null; byGps: boolean; now: number }) {
  const [t] = useT();
  const mins = (ms: number) => Math.max(0, Math.round((ms - now) / 60_000));
  let title: string;
  let detail: string;
  if (step.kind === 'ride') {
    title = stopsLeft === null ? t(`Naik ke ${step.leg.to.name}`, `Ride to ${step.leg.to.name}`) : stopsLeft <= 1 ? t(`Turun di stesen seterusnya: ${step.leg.to.name}`, `Get off at the next stop: ${step.leg.to.name}`) : t(`${stopsLeft} hentian lagi ke ${step.leg.to.name}`, `${stopsLeft} stops to ${step.leg.to.name}`);
    detail = now < step.startMs ? t(`Bertolak ${clock(step.startMs)} dari ${step.leg.from.name}`, `Leaves ${clock(step.startMs)} from ${step.leg.from.name}`) : t(`Tiba ~${clock(step.endMs)} (${mins(step.endMs)} min)`, `Arrives ~${clock(step.endMs)} (${mins(step.endMs)} min)`);
  } else if (step.kind === 'access') {
    title = step.access.type === 'walk' ? t(`Jalan kaki ke Stesen ${step.to.name}`, `Walk to ${step.to.name} station`) : t(`Grab/teksi ke Stesen ${step.to.name}`, `Grab/taxi to ${step.to.name} station`);
    detail = t(`Tren/bas bertolak ${clock(step.endMs)} (${mins(step.endMs)} min lagi)`, `Departs ${clock(step.endMs)} (in ${mins(step.endMs)} min)`);
  } else if (step.kind === 'walk') {
    title = t(`Tukar laluan: jalan kaki ke ${step.walk.to.name}`, `Change lines: walk to ${step.walk.to.name}`);
    detail = t(`Seterusnya bertolak ${clock(step.endMs)} (${mins(step.endMs)} min lagi)`, `Next one leaves ${clock(step.endMs)} (in ${mins(step.endMs)} min)`);
  } else {
    title = step.egress.type === 'walk' ? t(`Jalan kaki ${step.egress.km} km ke destinasi`, `Walk ${step.egress.km} km to the destination`) : t(`Grab/teksi ${step.egress.km} km ke destinasi`, `Grab/taxi ${step.egress.km} km to the destination`);
    detail = t(`Tiba ~${clock(step.endMs)}`, `Arrive ~${clock(step.endMs)}`);
  }
  return (
    <div className="mx-3 mb-2 rounded-2xl bg-white p-3 dark:bg-ink-800">
      <div className="flex items-center gap-2">
        {step.kind === 'ride' && <LineBadge leg={step.leg} />}
        <p className="min-w-0 flex-1 text-lg font-black leading-tight">{title}</p>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
        {step.kind === 'ride' && <Satellite className={cn('size-3.5', byGps ? 'text-jade-500' : 'text-ink-300')} aria-label={byGps ? t('ikut GPS', 'from GPS') : t('ikut jadual', 'from the timetable')} />}
        {detail}
      </p>
    </div>
  );
}

function StepIcon({ step }: { step: TripStep }) {
  if (step.kind === 'ride') return <TrainFront className="mt-0.5 size-4 shrink-0" style={{ color: step.leg.color }} />;
  if (step.kind === 'egress') return <Flag className="mt-0.5 size-4 shrink-0" />;
  if (step.kind === 'access' && step.access.type === 'ride') return <Car className="mt-0.5 size-4 shrink-0" />;
  if (step.kind === 'access') return <Footprints className="mt-0.5 size-4 shrink-0" />;
  return <MapPin className="mt-0.5 size-4 shrink-0" />;
}

function StepText({ step }: { step: TripStep }) {
  const [t] = useT();
  if (step.kind === 'ride')
    return (
      <>
        <LineBadge leg={step.leg} /> {step.leg.from.name} → {step.leg.to.name} <span className="text-xs text-ink-500">· {t(`${step.leg.stops} hentian`, `${step.leg.stops} stops`)}</span>
      </>
    );
  if (step.kind === 'access') return <>{t(`Ke Stesen ${step.to.name} (~${step.access.minutes} min)`, `To ${step.to.name} station (~${step.access.minutes} min)`)}</>;
  if (step.kind === 'walk') return <>{t(`Jalan kaki ke ${step.walk.to.name} (~${step.walk.minutes} min)`, `Walk to ${step.walk.to.name} (~${step.walk.minutes} min)`)}</>;
  return <>{t(`Ke destinasi (~${step.egress.minutes} min)`, `To the destination (~${step.egress.minutes} min)`)}</>;
}
