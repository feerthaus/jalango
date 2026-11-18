import { parseCsv, titleCase } from '../ktmb.js';

/**
 * Any GTFS feed (KTMB, Rapid KL rail, later buses) → plain trips with stop
 * times in seconds after the service day's midnight. Frequency-based trips
 * (frequencies.txt: "every 4 minutes from 7:00 to 9:00") become one trip per
 * departure. Ids are prefixed with the feed name so feeds can be combined.
 */

export type Mode = 'ets' | 'intercity' | 'komuter' | 'shuttle' | 'lrt' | 'mrt' | 'monorail' | 'brt' | 'bus' | 'erl';

export interface FeedStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface FeedRoute {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  mode: Mode;
}

export interface FeedTrip {
  id: string;
  routeId: string;
  serviceId: string;
  stops: string[];
  arr: number[];
  dep: number[];
}

export interface Calendar {
  start: string;
  end: string;
  days: boolean[];
}

export interface Feed {
  name: string;
  stops: FeedStop[];
  routes: FeedRoute[];
  trips: FeedTrip[];
  calendar: Map<string, Calendar>;
  /** `${serviceId}|${YYYYMMDD}` → 1 added, 2 removed */
  exceptions: Map<string, 1 | 2>;
}

const secs = (t: string) => {
  const [h, m, s] = t.trim().split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

/** Station names as people say them: "KL SENTRAL - REDONE" → "KL Sentral". */
export function stationName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s+-\s+(redone)$/i, '')
    // bus stop codes in front of the name: "KL1117 LRT Bangsar", "PJ790 SRA SEKSYEN 5"
    .replace(/^[A-Z]{1,4}\d{3,6}[A-Z]?\s+(?=\S)/i, '')
    .replace(/\s+/g, ' ');
  return titleCase(cleaned);
}

export function parseFeed(name: string, files: Record<string, string>, modeOf: (route: Record<string, string>) => Mode): Feed {
  for (const f of ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']) if (!files[f]) throw new Error(`${name}: GTFS missing ${f}`);
  const p = (id: string) => `${name}:${id}`;
  const stops: FeedStop[] = [];
  for (const r of parseCsv(files['stops.txt'])) {
    const lat = Number(r.stop_lat);
    const lng = Number(r.stop_lon);
    if (r.stop_id && Number.isFinite(lat) && Number.isFinite(lng)) stops.push({ id: p(r.stop_id), name: stationName(r.stop_name), lat, lng });
  }
  const routes: FeedRoute[] = parseCsv(files['routes.txt']).map((r) => ({
    id: p(r.route_id),
    // MRT feeder buses have the route number only in the long name ("T117")
    shortName: r.route_short_name || (/^[A-Z]{0,3}\d{1,4}[A-Z]?$/i.test(r.route_long_name) ? r.route_long_name : ''),
    longName: r.route_long_name,
    color: r.route_color ? `#${r.route_color.replace('#', '')}` : modeOf(r) === 'bus' ? '#0f766e' : '#3c5a9f',
    mode: modeOf(r),
  }));
  const tripMeta = new Map(parseCsv(files['trips.txt']).map((r) => [r.trip_id, { routeId: p(r.route_id), serviceId: r.service_id }]));
  const rows = new Map<string, { seq: number; stop: string; arr: number; dep: number }[]>();
  for (const r of parseCsv(files['stop_times.txt'])) {
    if (!tripMeta.has(r.trip_id) || !r.departure_time) continue;
    const list = rows.get(r.trip_id) ?? [];
    list.push({ seq: Number(r.stop_sequence), stop: p(r.stop_id), arr: secs(r.arrival_time || r.departure_time), dep: secs(r.departure_time) });
    rows.set(r.trip_id, list);
  }
  const freq = new Map<string, { start: number; end: number; headway: number }[]>();
  for (const r of parseCsv(files['frequencies.txt'] ?? '')) {
    const h = Number(r.headway_secs);
    if (!r.trip_id || !(h > 0)) continue;
    const list = freq.get(r.trip_id) ?? [];
    list.push({ start: secs(r.start_time), end: secs(r.end_time), headway: h });
    freq.set(r.trip_id, list);
  }
  const trips: FeedTrip[] = [];
  for (const [tripId, list] of rows) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.seq - b.seq);
    const meta = tripMeta.get(tripId)!;
    const base = { routeId: meta.routeId, serviceId: meta.serviceId, stops: list.map((x) => x.stop) };
    const windows = freq.get(tripId);
    if (!windows) {
      trips.push({ id: p(tripId), ...base, arr: list.map((x) => x.arr), dep: list.map((x) => x.dep) });
      continue;
    }
    // Frequency template: same running times, one trip per departure
    const t0 = list[0].dep;
    for (const w of windows) {
      for (let start = w.start; start < w.end; start += w.headway) {
        const shift = start - t0;
        trips.push({ id: `${p(tripId)}@${start}`, ...base, arr: list.map((x) => x.arr + shift), dep: list.map((x) => x.dep + shift) });
      }
    }
  }
  const calendar = new Map<string, Calendar>();
  for (const r of parseCsv(files['calendar.txt'] ?? '')) {
    calendar.set(r.service_id, { start: r.start_date, end: r.end_date, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => r[d] === '1') });
  }
  const exceptions = new Map<string, 1 | 2>();
  for (const r of parseCsv(files['calendar_dates.txt'] ?? '')) if (r.exception_type === '1' || r.exception_type === '2') exceptions.set(`${r.service_id}|${r.date}`, Number(r.exception_type) as 1 | 2);
  return { name, stops, routes, trips, calendar, exceptions };
}

/** KTMB routes: ETS, Intercity (SH, ERT), Shuttle Tebrau (ST), the rest Komuter. */
export const ktmbMode = (r: Record<string, string>): Mode =>
  r.route_id === 'ETS' ? 'ets' : r.route_id === 'SH' || r.route_id === 'ERT' ? 'intercity' : r.route_id === 'ST' ? 'shuttle' : 'komuter';

/** Rapid KL rail: the feed's `category` column (LRT, MRT, MRL, BRT). */
export const railMode = (r: Record<string, string>): Mode => {
  const c = (r.category ?? '').toUpperCase();
  return c === 'MRT' ? 'mrt' : c === 'MRL' ? 'monorail' : c === 'BRT' ? 'brt' : 'lrt';
};

/** Buses. */
export const busMode = (): Mode => 'bus';
