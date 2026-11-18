import type { AccessLeg, Station, TransitLeg, TransitOption, WalkLeg } from '@/services/transitService';
import type { Coordinates } from '@/types';
import { haversineMeters } from './geo';

/**
 * Following a public transport trip on the phone: which step you are on
 * (walk to the station, ride, change, walk to the destination), how many stops
 * are left, and when to warn "get off at the next stop".
 *
 * Uses GPS when it is good (above ground: KTM, elevated LRT, buses) and the
 * timetable when it is not (tunnels, weak signal). Never goes backwards on its
 * own; the person can always pick a step by hand.
 */

export type TripStep =
  | { kind: 'access'; access: AccessLeg; to: Station; startMs: number; endMs: number }
  | { kind: 'ride'; leg: TransitLeg; startMs: number; endMs: number }
  | { kind: 'walk'; walk: WalkLeg; startMs: number; endMs: number }
  | { kind: 'egress'; egress: AccessLeg; from: Station; startMs: number; endMs: number };

export interface TripProgress {
  /** current step (index into tripSteps) */
  step: number;
  /** ride steps already warned about */
  alerted: number[];
  done: boolean;
}

export interface TripTick {
  progress: TripProgress;
  /** on a ride: stops left to where you get off (estimate) */
  stopsLeft: number | null;
  /** true when the reading came from GPS, false from the timetable */
  byGps: boolean;
  /** a ride step to warn about now ("get off at the next stop") */
  alert: number | null;
}

const GOOD_ACCURACY_M = 150;
const ON_LINE_M = 400;

export function tripSteps(o: TransitOption): TripStep[] {
  const steps: TripStep[] = [];
  const legs = o.legs;
  const firstRide = legs.find((l): l is TransitLeg => l.type === 'transit');
  const lastRide = [...legs].reverse().find((l): l is TransitLeg => l.type === 'transit');
  if (!firstRide || !lastRide) return steps;
  steps.push({ kind: 'access', access: o.access, to: firstRide.from, startMs: Date.parse(o.leave), endMs: Date.parse(firstRide.depart) });
  legs.forEach((l, i) => {
    if (l.type === 'transit') {
      steps.push({ kind: 'ride', leg: l, startMs: Date.parse(l.depart), endMs: Date.parse(l.arrive) });
    } else {
      const prev = legs[i - 1] as TransitLeg | undefined;
      const next = legs.slice(i + 1).find((x): x is TransitLeg => x.type === 'transit');
      const start = prev?.type === 'transit' ? Date.parse(prev.arrive) : Date.now();
      steps.push({ kind: 'walk', walk: l, startMs: start, endMs: next ? Date.parse(next.depart) : start + l.minutes * 60_000 });
    }
  });
  steps.push({ kind: 'egress', egress: o.egress, from: lastRide.to, startMs: Date.parse(lastRide.arrive), endMs: Date.parse(o.arrive) });
  return steps;
}

export const startProgress = (): TripProgress => ({ step: 0, alerted: [], done: false });

const toC = (p: [number, number]): Coordinates => ({ lng: p[0], lat: p[1] });

/** Nearest stop on a ride and how far from the line we are. */
export function nearestStop(leg: TransitLeg, at: Coordinates): { index: number; meters: number } {
  let best = { index: 0, meters: Infinity };
  leg.path.forEach((p, i) => {
    const m = haversineMeters(at, toC(p));
    if (m < best.meters) best = { index: i, meters: m };
  });
  return best;
}

/** Last stop index of a ride (= number of stops travelled). */
const lastIndex = (leg: TransitLeg) => Math.max(1, leg.path.length - 1);

/** Timetable guess of the stop the train is at (or just left). */
function stopByTime(leg: TransitLeg, now: number): number {
  const a = Date.parse(leg.depart);
  const b = Date.parse(leg.arrive);
  if (now <= a) return 0;
  if (now >= b) return lastIndex(leg);
  return Math.floor(((now - a) / (b - a)) * lastIndex(leg));
}

/** Warn this long before the timetable arrival when there is no GPS: one stop's worth, 1–4 min. */
function warnBeforeMs(leg: TransitLeg): number {
  const per = (Date.parse(leg.arrive) - Date.parse(leg.depart)) / lastIndex(leg);
  return Math.min(240_000, Math.max(60_000, per));
}

/**
 * Move the trip along. `fix` is the latest location (null if none), `now` the clock.
 */
export function advanceTrip(steps: TripStep[], prev: TripProgress, fix: { coordinates: Coordinates; accuracy: number } | null, now: number, destination: Coordinates): TripTick {
  const progress: TripProgress = { ...prev, alerted: [...prev.alerted] };
  const gps = fix && fix.accuracy <= GOOD_ACCURACY_M ? fix.coordinates : null;
  let alert: number | null = null;
  let stopsLeft: number | null = null;
  let byGps = false;
  if (progress.done || steps.length === 0) return { progress, stopsLeft, byGps, alert };

  // GPS shows we are already riding a later leg (caught an earlier train, missed a step…)
  if (gps) {
    for (let i = steps.length - 1; i > progress.step; i--) {
      const s = steps[i];
      if (s.kind !== 'ride') continue;
      const near = nearestStop(s.leg, gps);
      if (near.meters < ON_LINE_M && near.index >= 1 && near.index < lastIndex(s.leg) && now >= s.startMs - 20 * 60_000) {
        progress.step = i;
        break;
      }
    }
  }

  // Walking / waiting steps: on to the ride once it has left the first station
  for (let guard = 0; guard < steps.length; guard++) {
    const s = steps[progress.step];
    const next = steps[progress.step + 1];
    if ((s.kind === 'access' || s.kind === 'walk') && next?.kind === 'ride') {
      const near = gps ? nearestStop(next.leg, gps) : null;
      const boarded = near ? near.meters < ON_LINE_M && near.index >= 1 : now >= next.startMs + 60_000;
      if (boarded) {
        progress.step += 1;
        continue;
      }
    }
    if (s.kind === 'ride') {
      const near = gps ? nearestStop(s.leg, gps) : null;
      const onLine = Boolean(near && near.meters < ON_LINE_M);
      const at = onLine ? near!.index : stopByTime(s.leg, now);
      byGps = onLine;
      stopsLeft = Math.max(0, lastIndex(s.leg) - at);
      const arrived = onLine ? at === lastIndex(s.leg) && haversineMeters(gps!, s.leg.to) < 300 && now >= s.startMs : now >= s.endMs + 60_000;
      if (!progress.alerted.includes(progress.step)) {
        const soon = onLine ? stopsLeft <= 1 : now >= s.endMs - warnBeforeMs(s.leg);
        if (soon) {
          progress.alerted.push(progress.step);
          alert = progress.step;
        }
      }
      if (arrived && steps[progress.step + 1]) {
        // past the last stop: count it as warned (no alarm after the fact) and move on
        if (!progress.alerted.includes(progress.step)) progress.alerted.push(progress.step);
        progress.step += 1;
        stopsLeft = null;
        byGps = false;
        alert = null;
        continue;
      }
    }
    if (s.kind === 'egress') {
      const there = gps ? haversineMeters(gps, destination) < 120 : now >= s.endMs + 10 * 60_000;
      if (there) progress.done = true;
    }
    break;
  }
  return { progress, stopsLeft, byGps, alert };
}
