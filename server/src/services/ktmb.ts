import { unzipSync, strFromU8 } from 'fflate';
import { HttpError } from '../lib/errors.js';
import type { GtfsRoute, GtfsStop, GtfsTrip, Timetable } from './trainPlanner.js';

/**
 * KTMB timetable (GTFS) from Malaysia's open data portal, updated daily by
 * KTMB. Fetched on demand and kept for 6 hours per server instance.
 */
const URL_ = 'https://api.data.gov.my/gtfs-static/ktmb';
const CACHE_MS = 6 * 3600_000;
let cache: { at: number; value: Timetable } | null = null;
let loading: Promise<Timetable> | null = null;

/** Minimal CSV (GTFS: comma separated, optional double quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const secs = (t: string) => {
  const [h, m, s] = t.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
};

export function buildTimetable(files: Record<string, string>): Timetable {
  const need = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'];
  for (const f of need) if (!files[f]) throw new Error(`GTFS missing ${f}`);
  const stops = new Map<string, GtfsStop>();
  for (const r of parseCsv(files['stops.txt'])) {
    const lat = Number(r.stop_lat);
    const lng = Number(r.stop_lon);
    if (r.stop_id && Number.isFinite(lat) && Number.isFinite(lng)) stops.set(r.stop_id, { id: r.stop_id, name: titleCase(r.stop_name), lat, lng });
  }
  const routes = new Map<string, GtfsRoute>();
  for (const r of parseCsv(files['routes.txt'])) routes.set(r.route_id, { id: r.route_id, shortName: r.route_short_name, longName: r.route_long_name, color: r.route_color });
  const trips = new Map<string, GtfsTrip>();
  for (const r of parseCsv(files['trips.txt'])) trips.set(r.trip_id, { id: r.trip_id, routeId: r.route_id, serviceId: r.service_id, stops: [] });
  const seq = new Map<GtfsTrip, number[]>();
  for (const r of parseCsv(files['stop_times.txt'])) {
    const trip = trips.get(r.trip_id);
    if (!trip || !stops.has(r.stop_id) || !r.departure_time) continue;
    trip.stops.push({ stop: r.stop_id, arr: secs(r.arrival_time || r.departure_time), dep: secs(r.departure_time), km: Number(r.shape_dist_traveled) || 0 });
    (seq.get(trip) ?? seq.set(trip, []).get(trip)!).push(Number(r.stop_sequence));
  }
  for (const [trip, s] of seq) {
    const order = s.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    trip.stops = order.map((i) => trip.stops[i]);
  }
  const calendar = new Map<string, { start: string; end: string; days: boolean[] }>();
  for (const r of parseCsv(files['calendar.txt'] ?? '')) {
    calendar.set(r.service_id, {
      start: r.start_date,
      end: r.end_date,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => r[d] === '1'),
    });
  }
  const exceptions = new Map<string, 1 | 2>();
  for (const r of parseCsv(files['calendar_dates.txt'] ?? '')) if (r.exception_type === '1' || r.exception_type === '2') exceptions.set(`${r.service_id}|${r.date}`, Number(r.exception_type) as 1 | 2);
  const feedDate = [...calendar.values()].map((c) => c.start).sort().pop() ?? '';
  return { feedDate, stops, routes, trips: [...trips.values()].filter((t) => t.stops.length >= 2), calendar, exceptions };
}

/** "KL SENTRAL" → "KL Sentral", "PULAU SEBANG/TAMPIN" → "Pulau Sebang/Tampin". */
export function titleCase(name: string): string {
  const keep = new Set(['KL', 'JB', 'KTM', 'ETS', 'UKM', 'UPM', 'KLIA', 'KLIA2', 'KTMB', 'KLCC', 'IOI', 'USJ', 'TRX', 'LRT', 'MRT', 'BRT', 'UTM', 'PPR', 'SS']);
  return name
    .toLowerCase()
    .replace(/[a-z]+/g, (w) => (keep.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .replace(/\bBdr\b/g, 'Bandar');
}

async function fetchTimetable(): Promise<Timetable> {
  const res = await fetch(URL_, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const files: Record<string, string> = {};
  for (const [name, data] of Object.entries(zip)) files[name.split('/').pop()!] = strFromU8(data);
  return buildTimetable(files);
}

export async function getKtmbTimetable(): Promise<Timetable> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  loading ??= fetchTimetable()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((err) => {
      if (cache) return cache.value; // yesterday's timetable beats nothing
      throw new HttpError(502, 'upstream_unreachable', `Train timetable unavailable (${err instanceof Error ? err.message : 'error'})`);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Tests: use a fixed timetable. */
export function setKtmbTimetable(value: Timetable | null): void {
  cache = value ? { at: Date.now(), value } : null;
}
