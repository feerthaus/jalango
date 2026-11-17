import type { Coordinates } from '../types.js';

/**
 * Train trips between towns from the KTMB timetable (GTFS, data.gov.my):
 * ETS, Intercity, Komuter and Shuttle Tebrau. Pure logic: the timetable is
 * loaded elsewhere (ktmb.ts). Fares are not in the open data, so they are
 * labelled estimates; the exact price is on KTMB's own site (Tambang Fleksi).
 */

export interface GtfsStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface GtfsRoute {
  id: string;
  shortName: string;
  longName: string;
  color: string;
}

export interface GtfsStopTime {
  stop: string;
  /** seconds after the service day's midnight (may pass 24:00) */
  arr: number;
  dep: number;
  /** km along the line from the trip's first stop */
  km: number;
}

export interface GtfsTrip {
  id: string;
  routeId: string;
  serviceId: string;
  stops: GtfsStopTime[];
}

export interface Timetable {
  feedDate: string;
  stops: Map<string, GtfsStop>;
  routes: Map<string, GtfsRoute>;
  trips: GtfsTrip[];
  /** service_id → [start YYYYMMDD, end YYYYMMDD, weekdays Mon..Sun] */
  calendar: Map<string, { start: string; end: string; days: boolean[] }>;
  /** `${service}|${YYYYMMDD}` → 1 added, 2 removed */
  exceptions: Map<string, 1 | 2>;
}

export type TrainKind = 'ets' | 'intercity' | 'komuter' | 'shuttle';

export interface AccessLeg {
  type: 'walk' | 'ride';
  km: number;
  minutes: number;
  /** e-hailing / taxi estimate (RM), 0 when walking */
  costMin: number;
  costMax: number;
}

export interface TrainLeg {
  type: 'train';
  kind: TrainKind;
  routeId: string;
  routeName: string;
  color: string;
  tripId: string;
  from: { id: string; name: string; lat: number; lng: number };
  to: { id: string; name: string; lat: number; lng: number };
  /** ISO times (Malaysia, +08:00) */
  depart: string;
  arrive: string;
  km: number;
  stops: number;
  /** estimated adult fare (RM): open data has no fares */
  fareMin: number;
  fareMax: number;
  /** needs a ticket bought in advance (ETS, Intercity, Shuttle Tebrau); Komuter: tap a card */
  ticket: boolean;
  /** stations along the way (for the map) */
  path: [number, number][];
}

export interface TrainOption {
  /** leave your start point at (ISO) */
  leave: string;
  /** reach the destination at (ISO) */
  arrive: string;
  minutes: number;
  transfers: number;
  access: AccessLeg;
  legs: TrainLeg[];
  egress: AccessLeg;
  fareMin: number;
  fareMax: number;
  /** fares + rides to/from the stations (RM, estimate, one person) */
  costMin: number;
  costMax: number;
}

const MYT_OFFSET_MS = 8 * 3600_000;
export const MAX_STATION_KM = 40;
const NEAREST_STATIONS = 6;
const BOARD_BUFFER_MIN = 10; // be at the platform before an intercity train
const TRANSFER_MIN = 10;
const MAX_TRANSFER_WAIT_MIN = 240;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Getting to/from a station: walk up to 1.2 km, otherwise a car ride (e-hailing estimate). */
export function accessLeg(straightKm: number): AccessLeg {
  if (straightKm <= 1.2) {
    const km = Math.round(straightKm * 1.25 * 10) / 10;
    return { type: 'walk', km, minutes: Math.max(1, Math.round((km / 4.5) * 60)), costMin: 0, costMax: 0 };
  }
  const km = Math.round(straightKm * 1.35 * 10) / 10; // roads aren't straight
  const minutes = Math.round((km / 35) * 60) + 5; // town traffic + pickup
  return { type: 'ride', km, minutes, costMin: Math.round(4 + km * 0.9), costMax: Math.round(6 + km * 1.4) };
}

export function trainKind(routeId: string): TrainKind {
  if (routeId === 'ETS') return 'ets';
  if (routeId === 'SH' || routeId === 'ERT') return 'intercity';
  if (routeId === 'ST') return 'shuttle';
  return 'komuter';
}

/**
 * Estimated adult fare (RM). KTMB prices vary by date and seat class
 * (Tambang Fleksi), so this is a range, always shown as an estimate.
 */
export function estimateFare(kind: TrainKind, km: number): { min: number; max: number } {
  const round = (n: number) => Math.max(1, Math.round(n));
  switch (kind) {
    case 'ets':
      return { min: Math.max(10, round(km * 0.15)), max: Math.max(14, round(km * 0.22)) };
    case 'intercity':
      return { min: Math.max(5, round(km * 0.07)), max: Math.max(8, round(km * 0.11)) };
    case 'shuttle':
      return { min: 5, max: 5 };
    case 'komuter':
      return { min: Math.max(1, Math.round((1.3 + km * 0.05) * 10) / 10), max: Math.max(2, Math.round((1.5 + km * 0.08) * 10) / 10) };
  }
}

/** "YYYYMMDD" and Monday-first weekday index for a Malaysian service day starting at `dayStartMs`. */
function serviceDay(dayStartMs: number): { ymd: string; weekday: number } {
  const d = new Date(dayStartMs + MYT_OFFSET_MS);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return { ymd, weekday: (d.getUTCDay() + 6) % 7 };
}

export function serviceRuns(tt: Timetable, serviceId: string, dayStartMs: number): boolean {
  const { ymd, weekday } = serviceDay(dayStartMs);
  const ex = tt.exceptions.get(`${serviceId}|${ymd}`);
  if (ex === 1) return true;
  if (ex === 2) return false;
  const c = tt.calendar.get(serviceId);
  return Boolean(c && ymd >= c.start && ymd <= c.end && c.days[weekday]);
}

/** Midnight (Malaysia time) of the day containing `ms`, as epoch ms. */
export function mytMidnight(ms: number): number {
  const local = ms + MYT_OFFSET_MS;
  return local - (local % 86_400_000) - MYT_OFFSET_MS;
}

const iso = (ms: number) => new Date(ms + MYT_OFFSET_MS).toISOString().replace('Z', '+08:00').replace(/\.\d{3}/, '');

function nearestStations(tt: Timetable, at: Coordinates): { stop: GtfsStop; km: number }[] {
  return [...tt.stops.values()]
    .map((stop) => ({ stop, km: haversineKm(at, stop) }))
    .filter((s) => s.km <= MAX_STATION_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, NEAREST_STATIONS);
}

interface Ride {
  trip: GtfsTrip;
  dayStart: number;
  i: number;
  j: number;
}

function leg(tt: Timetable, r: Ride): TrainLeg {
  const a = r.trip.stops[r.i];
  const b = r.trip.stops[r.j];
  const route = tt.routes.get(r.trip.routeId);
  const kind = trainKind(r.trip.routeId);
  const km = Math.round(Math.max(0, b.km - a.km));
  const fare = estimateFare(kind, km);
  const s = (id: string) => {
    const st = tt.stops.get(id)!;
    return { id: st.id, name: st.name, lat: st.lat, lng: st.lng };
  };
  return {
    type: 'train',
    kind,
    routeId: r.trip.routeId,
    routeName: route?.longName || route?.shortName || r.trip.routeId,
    color: route?.color ? `#${route.color}` : '#3c5a9f',
    tripId: r.trip.id,
    from: s(a.stop),
    to: s(b.stop),
    depart: iso(r.dayStart + a.dep * 1000),
    arrive: iso(r.dayStart + b.arr * 1000),
    km,
    stops: r.j - r.i,
    fareMin: fare.min,
    fareMax: fare.max,
    ticket: kind !== 'komuter',
    path: r.trip.stops.slice(r.i, r.j + 1).map((x) => {
      const st = tt.stops.get(x.stop)!;
      return [st.lng, st.lat];
    }),
  };
}

/**
 * Train options from `from` to `to`, leaving after `nowMs`: direct trains and
 * one change, within the next ~24 hours: the 3 that arrive first, plus the
 * cheapest one leaving in the next 6 hours. In leaving order.
 */
export function planTrainTrips(tt: Timetable, from: Coordinates, to: Coordinates, nowMs: number): TrainOption[] {
  const origins = nearestStations(tt, from);
  const dests = nearestStations(tt, to);
  if (!origins.length || !dests.length) return [];
  const originAccess = new Map(origins.map((o) => [o.stop.id, accessLeg(o.km)]));
  const destEgress = new Map(dests.map((d) => [d.stop.id, accessLeg(d.km)]));
  // Same station both ends, or the stations are as close as the trip itself: no train trip
  if (haversineKm(from, to) < 15) return [];

  const today = mytMidnight(nowMs);
  const days = [today - 86_400_000, today, today + 86_400_000]; // yesterday's late trips run past midnight
  const horizon = nowMs + 26 * 3600_000;
  const active: { trip: GtfsTrip; dayStart: number }[] = [];
  for (const dayStart of days) for (const trip of tt.trips) if (serviceRuns(tt, trip.serviceId, dayStart)) active.push({ trip, dayStart });

  // stop → trips calling there (for changes)
  const byStop = new Map<string, { trip: GtfsTrip; dayStart: number; idx: number }[]>();
  for (const a of active) a.trip.stops.forEach((st, idx) => {
    const list = byStop.get(st.stop) ?? [];
    list.push({ ...a, idx });
    byStop.set(st.stop, list);
  });

  const options: TrainOption[] = [];
  const build = (rides: Ride[]): TrainOption | null => {
    const first = rides[0];
    const last = rides[rides.length - 1];
    const access = originAccess.get(first.trip.stops[first.i].stop)!;
    const egress = destEgress.get(last.trip.stops[last.j].stop)!;
    const departMs = first.dayStart + first.trip.stops[first.i].dep * 1000;
    const leaveMs = departMs - (access.minutes + BOARD_BUFFER_MIN) * 60_000;
    if (leaveMs < nowMs || departMs > horizon) return null;
    const arriveMs = last.dayStart + last.trip.stops[last.j].arr * 1000 + egress.minutes * 60_000;
    const legs = rides.map((r) => leg(tt, r));
    const fareMin = Math.round(legs.reduce((s, l) => s + l.fareMin, 0) * 10) / 10;
    const fareMax = Math.round(legs.reduce((s, l) => s + l.fareMax, 0) * 10) / 10;
    return {
      leave: iso(leaveMs),
      arrive: iso(arriveMs),
      minutes: Math.round((arriveMs - leaveMs) / 60_000),
      transfers: rides.length - 1,
      access,
      legs,
      egress,
      fareMin,
      fareMax,
      costMin: Math.round((fareMin + access.costMin + egress.costMin) * 10) / 10,
      costMax: Math.round((fareMax + access.costMax + egress.costMax) * 10) / 10,
    };
  };

  for (const a of active) {
    const st = a.trip.stops;
    for (let i = 0; i < st.length - 1; i++) {
      if (!originAccess.has(st[i].stop)) continue;
      // direct
      for (let j = i + 1; j < st.length; j++) {
        if (!destEgress.has(st[j].stop)) continue;
        const o = build([{ trip: a.trip, dayStart: a.dayStart, i, j }]);
        if (o) options.push(o);
      }
      // one change
      for (let k = i + 1; k < st.length; k++) {
        if (destEgress.has(st[k].stop)) continue;
        const readyMs = a.dayStart + st[k].arr * 1000 + TRANSFER_MIN * 60_000;
        for (const b of byStop.get(st[k].stop) ?? []) {
          if (b.trip === a.trip) continue;
          const departB = b.dayStart + b.trip.stops[b.idx].dep * 1000;
          if (departB < readyMs || departB > readyMs + MAX_TRANSFER_WAIT_MIN * 60_000) continue;
          for (let j = b.idx + 1; j < b.trip.stops.length; j++) {
            if (!destEgress.has(b.trip.stops[j].stop)) continue;
            const o = build([
              { trip: a.trip, dayStart: a.dayStart, i, j: k },
              { trip: b.trip, dayStart: b.dayStart, i: b.idx, j },
            ]);
            if (o) options.push(o);
          }
        }
      }
    }
  }

  // Best per departure train: earliest arrival, then fewer changes, then latest leave
  const ranked = options.sort((x, y) => x.arrive.localeCompare(y.arrive) || x.transfers - y.transfers || y.leave.localeCompare(x.leave));
  const out: TrainOption[] = [];
  const seenFirst = new Set<string>();
  for (const o of ranked) {
    const key = `${o.legs[0].tripId}|${o.legs[0].depart}`;
    if (seenFirst.has(key)) continue;
    // drop options that leave earlier but don't arrive earlier than one we kept
    if (out.some((k) => k.leave >= o.leave && k.arrive <= o.arrive)) continue;
    seenFirst.add(key);
    out.push(o);
    if (out.length >= 3) break;
  }
  // Also the cheapest way in the next 6 hours (e.g. Komuter instead of ETS), if it isn't there yet
  const quickest = Math.min(...out.map((o) => o.minutes));
  const soon = ranked.filter((o) => Date.parse(o.leave) - nowMs <= 6 * 3600_000 && o.minutes <= quickest * 1.6 + 30);
  const cheapest = soon.sort((x, y) => x.costMax - y.costMax || x.arrive.localeCompare(y.arrive))[0];
  if (cheapest && out.length && cheapest.costMax < Math.min(...out.map((o) => o.costMax)) - 2 && !out.includes(cheapest)) out.push(cheapest);
  return out.sort((x, y) => x.leave.localeCompare(y.leave));
}
