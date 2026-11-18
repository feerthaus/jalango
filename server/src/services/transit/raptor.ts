import type { Coordinates } from '../../types.js';
import type { Calendar, Feed, FeedRoute, Mode } from './gtfs.js';

/**
 * Public transport planner (RAPTOR: round-based, one round per vehicle taken)
 * over any set of GTFS feeds: KTMB (ETS, Intercity, Komuter) and Rapid KL rail
 * (LRT, MRT, Monorail, BRT), buses later. Changing lines on foot between nearby
 * stations (KL Sentral KTM ↔ LRT ↔ Monorail, Pasar Seni LRT ↔ MRT…) is a walk.
 * Fares aren't in the open data, so they're estimates.
 */

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Trip {
  id: string;
  serviceKey: string; // `${feed}|${serviceId}`
  arr: number[];
  dep: number[];
}

export interface Pattern {
  route: FeedRoute;
  stops: number[];
  trips: Trip[];
}

export interface Network {
  stops: Stop[];
  stopIndex: Map<string, number>;
  patterns: Pattern[];
  /** per stop: patterns calling there and where */
  stopPatterns: { p: number; pos: number }[][];
  /** per stop: stops you can walk to for a change, and how long it takes (s) */
  footpaths: { to: number; sec: number }[][];
  calendars: Map<string, Calendar>;
  exceptions: Map<string, 1 | 2>;
  feedDate: string;
}

const MYT = 8 * 3600_000;
const DAY = 86_400;
/** walking for a change of line: up to this far between stations */
const TRANSFER_M = 450;
const WALK_KMH = 4.5;
const MIN_CHANGE_S = 120;
/** boarding an intercity train: be at the platform early */
const INTERCITY_BUFFER_S = 600;
const MAX_RIDES = 4;
const WALK_ACCESS_KM = 1.2;
const RIDE_ACCESS_KM = 40;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const walkSec = (km: number) => Math.round(((km * 1.3) / WALK_KMH) * 3600);

/** Join feeds into one network: patterns (same line, same stops), walking changes between nearby stations. */
export function buildNetwork(feeds: Feed[]): Network {
  const stops: Stop[] = [];
  const stopIndex = new Map<string, number>();
  for (const f of feeds) for (const s of f.stops) if (!stopIndex.has(s.id)) {
    stopIndex.set(s.id, stops.length);
    stops.push(s);
  }
  const routes = new Map<string, FeedRoute>();
  for (const f of feeds) for (const r of f.routes) routes.set(r.id, r);
  const byKey = new Map<string, Pattern>();
  for (const f of feeds) {
    for (const t of f.trips) {
      const idx = t.stops.map((s) => stopIndex.get(s));
      if (idx.some((i) => i === undefined)) continue;
      const route = routes.get(t.routeId);
      if (!route) continue;
      const key = `${t.routeId}|${idx.join(',')}`;
      let p = byKey.get(key);
      if (!p) byKey.set(key, (p = { route, stops: idx as number[], trips: [] }));
      p.trips.push({ id: t.id, serviceKey: `${f.name}|${t.serviceId}`, arr: t.arr, dep: t.dep });
    }
  }
  const patterns = [...byKey.values()];
  for (const p of patterns) p.trips.sort((a, b) => a.dep[0] - b.dep[0]);
  const calendars = new Map<string, Calendar>();
  const exceptions = new Map<string, 1 | 2>();
  for (const f of feeds) {
    for (const [k, v] of f.calendar) calendars.set(`${f.name}|${k}`, v);
    for (const [k, v] of f.exceptions) exceptions.set(`${f.name}|${k}`, v);
  }
  return assembleNetwork(stops, patterns, calendars, exceptions);
}

/** Indexes the planner needs (which patterns call at each stop, walking changes), from stops and patterns. */
export function assembleNetwork(stops: Stop[], patterns: Pattern[], calendars: Map<string, Calendar>, exceptions: Map<string, 1 | 2>): Network {
  const stopIndex = new Map(stops.map((s, i) => [s.id, i]));
  const stopPatterns: { p: number; pos: number }[][] = stops.map(() => []);
  patterns.forEach((p, pi) => p.stops.forEach((s, pos) => stopPatterns[s].push({ p: pi, pos })));
  // Walking changes: a coarse grid keeps this fast
  const cell = (s: Stop) => `${Math.floor(s.lat * 200)},${Math.floor(s.lng * 200)}`;
  const grid = new Map<string, number[]>();
  stops.forEach((s, i) => (grid.get(cell(s)) ?? grid.set(cell(s), []).get(cell(s))!).push(i));
  const footpaths = stops.map((s, i) => {
    const out: { to: number; sec: number }[] = [];
    const [cy, cx] = [Math.floor(s.lat * 200), Math.floor(s.lng * 200)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of grid.get(`${cy + dy},${cx + dx}`) ?? []) {
      if (j === i) continue;
      const km = haversineKm(s, stops[j]);
      if (km * 1000 <= TRANSFER_M) out.push({ to: j, sec: Math.max(MIN_CHANGE_S, walkSec(km)) });
    }
    return out;
  });
  const feedDate = [...calendars.values()].map((c) => c.start).sort().pop() ?? '';
  return { stops, stopIndex, patterns, stopPatterns, footpaths, calendars, exceptions, feedDate };
}

/** Malaysian midnight of the day containing `ms`. */
export function mytMidnight(ms: number): number {
  const local = ms + MYT;
  return local - (local % 86_400_000) - MYT;
}

function runs(net: Network, serviceKey: string, dayStartMs: number): boolean {
  const d = new Date(dayStartMs + MYT);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const ex = net.exceptions.get(`${serviceKey}|${ymd}`);
  if (ex) return ex === 1;
  const c = net.calendars.get(serviceKey);
  return Boolean(c && ymd >= c.start && ymd <= c.end && c.days[(d.getUTCDay() + 6) % 7]);
}

interface Instance {
  trip: Trip;
  /** seconds to add (yesterday −86400, today 0, tomorrow +86400) */
  off: number;
}

const instanceCache = new WeakMap<Network, Map<number, Instance[][]>>();
/** Per pattern: trips running yesterday/today/tomorrow, in time order (relative to today's midnight). */
function instances(net: Network, today: number): Instance[][] {
  let byDay = instanceCache.get(net);
  if (!byDay) instanceCache.set(net, (byDay = new Map()));
  const hit = byDay.get(today);
  if (hit) return hit;
  const out = net.patterns.map((p) => {
    const list: Instance[] = [];
    for (const k of [-1, 0, 1]) {
      const day = today + k * 86_400_000;
      const ok = new Map<string, boolean>();
      for (const trip of p.trips) {
        let r = ok.get(trip.serviceKey);
        if (r === undefined) ok.set(trip.serviceKey, (r = runs(net, trip.serviceKey, day)));
        if (r) list.push({ trip, off: k * DAY });
      }
    }
    return list.sort((a, b) => a.trip.dep[0] + a.off - (b.trip.dep[0] + b.off));
  });
  if (byDay.size > 3) byDay.clear();
  byDay.set(today, out);
  return out;
}

export interface AccessLeg {
  type: 'walk' | 'ride';
  km: number;
  minutes: number;
  costMin: number;
  costMax: number;
}

/** Walk up to 1.2 km; otherwise a car ride (Grab/taxi estimate). */
export function accessLeg(straightKm: number): AccessLeg {
  if (straightKm <= WALK_ACCESS_KM) {
    const km = Math.round(straightKm * 1.25 * 10) / 10;
    return { type: 'walk', km, minutes: Math.max(1, Math.round((km / WALK_KMH) * 60)), costMin: 0, costMax: 0 };
  }
  const km = Math.round(straightKm * 1.35 * 10) / 10;
  return { type: 'ride', km, minutes: Math.round((km / 35) * 60) + 5, costMin: Math.round(4 + km * 0.9), costMax: Math.round(6 + km * 1.4) };
}

const RAPID: Mode[] = ['lrt', 'mrt', 'monorail', 'brt'];
const needsTicket = (m: Mode) => m === 'ets' || m === 'intercity' || m === 'shuttle';

/** Estimated adult fare (RM): open data has none. Rapid KL rail: one fare for a trip across its lines. */
export function estimateFare(mode: Mode, km: number): { min: number; max: number } {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  switch (mode) {
    case 'ets':
      return { min: Math.max(10, Math.round(km * 0.15)), max: Math.max(14, Math.round(km * 0.22)) };
    case 'intercity':
      return { min: Math.max(5, Math.round(km * 0.07)), max: Math.max(8, Math.round(km * 0.11)) };
    case 'shuttle':
      return { min: 5, max: 5 };
    case 'komuter':
      return { min: Math.max(1, r1(1.3 + km * 0.05)), max: Math.max(2, r1(1.5 + km * 0.08)) };
    case 'bus':
      return { min: 1, max: Math.max(2, r1(1 + km * 0.1)) };
    default: // LRT, MRT, Monorail, BRT
      return { min: Math.min(6.5, Math.max(0.8, r1(0.7 + km * 0.12))), max: Math.min(7.5, Math.max(1.2, r1(1 + km * 0.16))) };
  }
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface WalkLeg {
  type: 'walk';
  from: Place;
  to: Place;
  minutes: number;
  km: number;
}

export interface TransitLeg {
  type: 'transit';
  mode: Mode;
  routeName: string;
  shortName: string;
  color: string;
  tripId: string;
  /** this run of the trip (trip id + day), to tell runs apart */
  tripKey: string;
  from: Place;
  to: Place;
  depart: string;
  arrive: string;
  stops: number;
  km: number;
  fareMin: number;
  fareMax: number;
  /** fare already counted on an earlier leg (one Rapid KL fare across lines) */
  fareShared: boolean;
  ticket: boolean;
  path: [number, number][];
}

export interface TransitOption {
  leave: string;
  arrive: string;
  minutes: number;
  transfers: number;
  access: AccessLeg;
  legs: (TransitLeg | WalkLeg)[];
  egress: AccessLeg;
  fareMin: number;
  fareMax: number;
  costMin: number;
  costMax: number;
  modes: Mode[];
}

type Label =
  | { kind: 'access' }
  | { kind: 'ride'; p: number; inst: Instance; board: number; alight: number }
  | { kind: 'walk'; from: number; sec: number };

const iso = (ms: number) => new Date(ms + MYT).toISOString().replace('Z', '+08:00').replace(/\.\d{3}/, '');

function nearby(net: Network, at: Coordinates): Map<number, AccessLeg> {
  const scored = net.stops.map((s, i) => ({ i, km: haversineKm(at, s) })).filter((x) => x.km <= RIDE_ACCESS_KM).sort((a, b) => a.km - b.km);
  const out = new Map<number, AccessLeg>();
  // Stations in walking distance: walk to them (no Grab across town to beat the train).
  // None: a car ride to the 6 nearest.
  const walkable = scored.filter((x) => x.km <= WALK_ACCESS_KM).slice(0, 20);
  for (const x of walkable.length ? walkable : scored.slice(0, 6)) out.set(x.i, accessLeg(x.km));
  return out;
}

/** One RAPTOR search leaving at `departMs`: the best option for each number of vehicles (fewer changes vs earlier arrival). */
function search(net: Network, origins: Map<number, AccessLeg>, dests: Map<number, AccessLeg>, departMs: number, banned: Set<string>): { k: number; stop: number; arriveSec: number; labels: Label[][]; tau: Float64Array[] }[] {
  const today = mytMidnight(departMs);
  const t0 = (departMs - today) / 1000;
  const inst = instances(net, today);
  const n = net.stops.length;
  const tau: Float64Array[] = [];
  const labels: Label[][] = [];
  const best = new Float64Array(n).fill(Infinity);
  tau.push(new Float64Array(n).fill(Infinity));
  labels.push(new Array(n));
  let marked = new Set<number>();
  for (const [s, a] of origins) {
    tau[0][s] = t0 + a.minutes * 60 + 60; // a minute to get to the platform
    best[s] = tau[0][s];
    labels[0][s] = { kind: 'access' };
    marked.add(s);
  }
  const results: { k: number; stop: number; arriveSec: number; labels: Label[][]; tau: Float64Array[] }[] = [];
  let bestTarget = Infinity;
  for (let k = 1; k <= MAX_RIDES && marked.size; k++) {
    tau.push(new Float64Array(tau[k - 1]));
    labels.push(new Array(n));
    const prev = tau[k - 1];
    const cur = tau[k];
    // patterns to scan, from the earliest marked stop
    const queue = new Map<number, number>();
    for (const s of marked) for (const { p, pos } of net.stopPatterns[s]) if (!queue.has(p) || pos < queue.get(p)!) queue.set(p, pos);
    const newly = new Set<number>();
    for (const [pi, start] of queue) {
      const pat = net.patterns[pi];
      const list = inst[pi];
      const buffer = needsTicket(pat.route.mode) ? INTERCITY_BUFFER_S : 0;
      let trip: Instance | null = null;
      let board = -1;
      for (let i = start; i < pat.stops.length; i++) {
        const s = pat.stops[i];
        if (trip) {
          const a = trip.trip.arr[i] + trip.off;
          if (a < Math.min(best[s], bestTarget)) {
            cur[s] = a;
            best[s] = a;
            labels[k][s] = { kind: 'ride', p: pi, inst: trip, board, alight: i };
            newly.add(s);
          }
        }
        if (prev[s] < Infinity && labels[k - 1][s]) {
          const ready = prev[s] + (k > 1 ? 60 : 0) + buffer;
          if (!trip || ready <= trip.trip.dep[i] + trip.off) {
            // earliest instance leaving here at or after `ready` (binary search: trips don't overtake)
            let lo = 0;
            let hi = list.length;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (list[mid].trip.dep[i] + list[mid].off < ready) lo = mid + 1;
              else hi = mid;
            }
            // skip vehicles already used as another option's main ride
            while (lo < list.length && banned.has(`${list[lo].trip.id}|${list[lo].off}`)) lo++;
            const cand = list[lo];
            if (cand && cand.trip.dep[i] + cand.off - t0 < 26 * 3600 && (!trip || cand.trip.dep[i] + cand.off < trip.trip.dep[i] + trip.off)) {
              trip = cand;
              board = i;
            }
          }
        }
      }
    }
    // walk to nearby stations for a change
    for (const s of [...newly]) {
      for (const f of net.footpaths[s]) {
        const a = cur[s] + f.sec;
        if (a < Math.min(best[f.to], bestTarget)) {
          cur[f.to] = a;
          best[f.to] = a;
          labels[k][f.to] = { kind: 'walk', from: s, sec: f.sec };
          newly.add(f.to);
        }
      }
    }
    marked = newly;
    // best arrival at the destination using k vehicles
    let roundBest: { stop: number; arriveSec: number } | null = null;
    for (const [d, e] of dests) {
      if (!labels[k][d]) continue;
      const at = cur[d] + e.minutes * 60;
      if (!roundBest || at < roundBest.arriveSec) roundBest = { stop: d, arriveSec: at };
    }
    if (roundBest && roundBest.arriveSec < bestTarget) {
      bestTarget = roundBest.arriveSec;
      results.push({ k, ...roundBest, labels, tau });
    }
  }
  return results;
}

function place(net: Network, i: number): Place {
  const s = net.stops[i];
  return { id: s.id, name: s.name, lat: s.lat, lng: s.lng };
}

function reconstruct(net: Network, r: { k: number; stop: number; labels: Label[][] }, origins: Map<number, AccessLeg>, dests: Map<number, AccessLeg>, today: number): TransitOption | null {
  const legs: (TransitLeg | WalkLeg)[] = [];
  let k = r.k;
  let s = r.stop;
  let guard = 0;
  while (guard++ < 20) {
    const l = r.labels[k][s];
    if (!l) return null;
    if (l.kind === 'access') break;
    if (l.kind === 'walk') {
      const km = Math.round(haversineKm(net.stops[l.from], net.stops[s]) * 1.3 * 100) / 100;
      legs.unshift({ type: 'walk', from: place(net, l.from), to: place(net, s), minutes: Math.round(l.sec / 60), km });
      s = l.from;
      continue;
    }
    const pat = net.patterns[l.p];
    const t = l.inst;
    const path: [number, number][] = pat.stops.slice(l.board, l.alight + 1).map((i) => [net.stops[i].lng, net.stops[i].lat]);
    let km = 0;
    for (let i = 1; i < path.length; i++) km += haversineKm({ lng: path[i - 1][0], lat: path[i - 1][1] }, { lng: path[i][0], lat: path[i][1] });
    km = Math.round(km * 1.1);
    legs.unshift({
      type: 'transit',
      mode: pat.route.mode,
      routeName: pat.route.longName || pat.route.shortName,
      shortName: pat.route.shortName,
      color: pat.route.color,
      tripId: t.trip.id,
      tripKey: `${t.trip.id}|${t.off}`,
      from: place(net, pat.stops[l.board]),
      to: place(net, pat.stops[l.alight]),
      depart: iso(today + (t.trip.dep[l.board] + t.off) * 1000),
      arrive: iso(today + (t.trip.arr[l.alight] + t.off) * 1000),
      stops: l.alight - l.board,
      km,
      fareMin: 0,
      fareMax: 0,
      fareShared: false,
      ticket: needsTicket(pat.route.mode),
      path,
    });
    s = pat.stops[l.board];
    k -= 1;
  }
  const rides = legs.filter((l): l is TransitLeg => l.type === 'transit');
  if (!rides.length) return null;
  // Fares: Rapid KL rail legs in a row share one fare (by total distance)
  for (let i = 0; i < rides.length; i++) {
    const l = rides[i];
    if (RAPID.includes(l.mode)) {
      if (i > 0 && RAPID.includes(rides[i - 1].mode)) continue;
      let km = 0;
      let j = i;
      while (j < rides.length && RAPID.includes(rides[j].mode)) km += rides[j++].km;
      const f = estimateFare(l.mode, km);
      l.fareMin = f.min;
      l.fareMax = f.max;
      for (let x = i + 1; x < j; x++) rides[x].fareShared = true;
    } else {
      const f = estimateFare(l.mode, l.km);
      l.fareMin = f.min;
      l.fareMax = f.max;
    }
  }
  const first = rides[0];
  const last = rides[rides.length - 1];
  const access = origins.get(net.stopIndex.get(first.from.id)!)!;
  // the trip can end with a walk between stops: egress is from the stop it ends at
  const egress = dests.get(r.stop)!;
  // same rule as the search: a minute to the platform, plus 10 for an intercity train
  const leaveMs = Date.parse(first.depart) - (access.minutes + 1 + (first.ticket ? INTERCITY_BUFFER_S / 60 : 0)) * 60_000;
  const arriveMs = Date.parse(last.arrive) + egress.minutes * 60_000;
  const fareMin = Math.round(rides.reduce((sum, l) => sum + l.fareMin, 0) * 10) / 10;
  const fareMax = Math.round(rides.reduce((sum, l) => sum + l.fareMax, 0) * 10) / 10;
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
    modes: [...new Set(rides.map((l) => l.mode))],
  };
}

const mainRide = (o: TransitOption): TransitLeg => {
  const rides = o.legs.filter((l): l is TransitLeg => l.type === 'transit');
  return rides.reduce((a, b) => (Date.parse(b.arrive) - Date.parse(b.depart) > Date.parse(a.arrive) - Date.parse(a.depart) ? b : a));
};

/**
 * The search leaves as early as possible, so a later train can come with a
 * long wait at the station. Search again leaving just in time for that option's
 * main ride, and keep the result if it uses the same ride and leaves later.
 */
function tighten(net: Network, o: TransitOption, origins: Map<number, AccessLeg>, dests: Map<number, AccessLeg>, nowMs: number): TransitOption {
  const main = mainRide(o);
  const i = o.legs.indexOf(main);
  let pre = o.access.minutes + 1 + (main.ticket ? INTERCITY_BUFFER_S / 60 : 0);
  for (const l of o.legs.slice(0, i)) pre += l.type === 'walk' ? l.minutes : (Date.parse(l.arrive) - Date.parse(l.depart)) / 60_000 + 1;
  // 12 minutes of slack for the vehicles before the main ride
  const departMs = Date.parse(main.depart) - (pre + 12) * 60_000;
  if (departMs <= Date.parse(o.leave) || departMs < nowMs) return o;
  const today = mytMidnight(nowMs);
  const better = search(net, origins, dests, departMs, new Set())
    .map((r) => reconstruct(net, r, origins, dests, today))
    .filter((x): x is TransitOption => x !== null && x.legs.some((l) => l.type === 'transit' && l.tripKey === main.tripKey) && x.arrive <= o.arrive)
    .sort((a, b) => b.leave.localeCompare(a.leave))[0];
  return better && better.leave > o.leave ? better : o;
}

/**
 * Public transport options from `from` to `to`, leaving after `nowMs`: the
 * quickest, the ones with fewer changes, and the next departures; plus the
 * cheapest if it isn't among them. In leaving order, at most 4.
 */
export function planTransit(net: Network, from: Coordinates, to: Coordinates, nowMs: number): TransitOption[] {
  if (haversineKm(from, to) < 1.5) return []; // just walk
  const origins = nearby(net, from);
  const dests = nearby(net, to);
  if (!origins.size || !dests.size) return [];
  const all: TransitOption[] = [];
  const banned = new Set<string>();
  const today = mytMidnight(nowMs);
  for (let run = 0; run < 3; run++) {
    const found = search(net, origins, dests, nowMs, banned)
      .map((r) => reconstruct(net, r, origins, dests, today))
      .filter((o): o is TransitOption => o !== null);
    if (!found.length) break;
    // leave as late as still works: no hour-long wait at KL Sentral for the next ETS
    all.push(...found.map((o) => tighten(net, o, origins, dests, nowMs)));
    // next search: without the quickest option's main vehicle (its longest ride),
    // so it finds the following departure, not a later LRT to the same ETS
    for (const o of found) banned.add(mainRide(o).tripKey);
  }
  const signature = (o: TransitOption) => o.legs.map((l) => (l.type === 'transit' ? `${l.tripId}@${l.depart}` : 'w')).join('|');
  const unique = [...new Map(all.map((o) => [signature(o), o])).values()];
  // same arrival: the one leaving latest first (less waiting), then fewer changes
  const ranked = unique.sort((a, b) => a.arrive.localeCompare(b.arrive) || a.transfers - b.transfers || b.leave.localeCompare(a.leave));
  const kept: TransitOption[] = [];
  for (const o of ranked) {
    // dominated: another one leaves no earlier, arrives no later, with no more changes
    if (kept.some((x) => x.leave >= o.leave && x.arrive <= o.arrive && x.transfers <= o.transfers)) continue;
    kept.push(o);
    if (kept.length >= 3) break;
  }
  if (kept.length) {
    const quickest = Math.min(...kept.map((o) => o.minutes));
    const cheapest = ranked.filter((o) => Date.parse(o.leave) - nowMs <= 6 * 3600_000 && o.minutes <= quickest * 1.6 + 30).sort((a, b) => a.costMax - b.costMax)[0];
    if (cheapest && !kept.includes(cheapest) && cheapest.costMax < Math.min(...kept.map((o) => o.costMax)) - 2) kept.push(cheapest);
  }
  return kept.sort((a, b) => a.leave.localeCompare(b.leave));
}
