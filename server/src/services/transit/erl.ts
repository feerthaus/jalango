import { parseFeed, type Feed } from './gtfs.js';

/**
 * KLIA Ekspres and KLIA Transit (Express Rail Link). ERL publishes no open
 * GTFS, so this is a hand-made timetable from ERL's published service pattern
 * (owner's request, Nov 2026): fixed stops, running times and headways, not
 * exact departures. The app labels every time as an estimate.
 *
 * Sources (checked 18 Nov 2026): ERL fare notice and press reports of the
 * 1 Jan 2027 fare change (The Star, Malay Mail, paultan.org); running times
 * and headways from ERL's service guideline as reported by klia2.info and
 * Wikipedia; station coordinates from Wikipedia and the Rapid KL GTFS
 * (Putrajaya Sentral, KL Sentral, Bandar Tasik Selatan share a building).
 *
 * Update here when ERL changes its timetable or fares.
 */

const STOPS = [
  { id: 'KLS', name: 'KL Sentral', lat: 3.1342, lng: 101.6862 },
  { id: 'BTS', name: 'Bandar Tasik Selatan', lat: 3.0762, lng: 101.7112 },
  { id: 'PJY', name: 'Putrajaya & Cyberjaya', lat: 2.9316, lng: 101.6714 },
  { id: 'STG', name: 'Salak Tinggi', lat: 2.8257, lng: 101.7134 },
  { id: 'KT1', name: 'KLIA T1', lat: 2.755, lng: 101.7049 },
  { id: 'KT2', name: 'KLIA T2', lat: 2.744, lng: 101.687 },
] as const;
type StopId = (typeof STOPS)[number]['id'];

/** Minutes from the first station, per direction. */
const TRANSIT_OUT: [StopId, number][] = [['KLS', 0], ['BTS', 7], ['PJY', 19], ['STG', 28], ['KT1', 35], ['KT2', 39]];
const TRANSIT_IN: [StopId, number][] = [['KT2', 0], ['KT1', 4], ['STG', 11], ['PJY', 20], ['BTS', 32], ['KLS', 39]];
const EKSPRES_OUT: [StopId, number][] = [['KLS', 0], ['KT1', 28], ['KT2', 31]];
const EKSPRES_IN: [StopId, number][] = [['KT2', 0], ['KT1', 3], ['KLS', 31]];

/** [from, to, headway minutes] by time of day; weekdays have 15-minute peaks. */
type Window = [string, string, number];
const EKSPRES_WD: Window[] = [['05:00', '06:00', 20], ['06:00', '09:00', 15], ['09:00', '16:00', 20], ['16:00', '22:00', 15], ['22:00', '23:01', 20]];
const EKSPRES_WE: Window[] = [['05:00', '23:01', 20]];
const TRANSIT_WD: Window[] = [['05:00', '06:00', 30], ['06:00', '09:00', 15], ['09:00', '16:00', 30], ['16:00', '22:00', 15], ['22:00', '24:01', 30]];
const TRANSIT_WE: Window[] = [['05:00', '24:01', 30]];

const hms = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function csv(rows: (string | number)[][]): string {
  return rows.map((r) => r.join(',')).join('\n');
}

let built: Feed | null = null;

/** The ERL network as a GTFS feed (same shape as the data.gov.my ones). */
export function erlFeed(): Feed {
  if (built) return built;
  const routes = [
    ['EKS', 'Ekspres', 'KLIA Ekspres', '7b2d8e'],
    ['TRA', 'Transit', 'KLIA Transit', '0e8f8a'],
  ];
  const trips: (string | number)[][] = [];
  const times: (string | number)[][] = [];
  const freqs: (string | number)[][] = [];
  const add = (route: string, dir: string, pattern: [StopId, number][], service: string, windows: Window[]) => {
    const id = `${route}-${dir}-${service}`;
    trips.push([route, service, id]);
    const start = toMin(windows[0][0]);
    pattern.forEach(([stop, m], i) => times.push([id, hms(start + m), hms(start + m), stop, i + 1]));
    for (const [a, b, h] of windows) freqs.push([id, `${hms(toMin(a))}`, `${hms(toMin(b))}`, h * 60]);
  };
  for (const [service, eks, tra] of [['WD', EKSPRES_WD, TRANSIT_WD], ['WE', EKSPRES_WE, TRANSIT_WE]] as const) {
    add('EKS', 'out', EKSPRES_OUT, service, eks);
    add('EKS', 'in', EKSPRES_IN, service, eks);
    add('TRA', 'out', TRANSIT_OUT, service, tra);
    add('TRA', 'in', TRANSIT_IN, service, tra);
  }
  const files = {
    'stops.txt': csv([['stop_id', 'stop_name', 'stop_lat', 'stop_lon'], ...STOPS.map((s) => [s.id, s.name, s.lat, s.lng])]),
    'routes.txt': csv([['route_id', 'route_short_name', 'route_long_name', 'route_color'], ...routes]),
    'trips.txt': csv([['route_id', 'service_id', 'trip_id'], ...trips]),
    'stop_times.txt': csv([['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'], ...times]),
    'frequencies.txt': csv([['trip_id', 'start_time', 'end_time', 'headway_secs'], ...freqs]),
    'calendar.txt': csv([
      ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
      ['WD', 1, 1, 1, 1, 1, 0, 0, '20260101', '20301231'],
      ['WE', 0, 0, 0, 0, 0, 1, 1, '20260101', '20301231'],
    ]),
  };
  built = parseFeed('erl', files, () => 'erl');
  return built;
}

/**
 * Adult one-way fares (RM). ERL's table: from KL Sentral and, from 1 Jan 2027,
 * every pair. Pairs not published for the current table are estimated from the
 * 2027 fare (about 18% higher on average), so they come back as a range.
 */
const NEW_FARES_FROM = Date.parse('2027-01-01T00:00:00+08:00');
const key = (a: string, b: string) => [a, b].sort().join('-');
const AIRPORT = ['KT1', 'KT2'];
function pairFare(a: string, b: string, table: 'now' | 'new'): number | null {
  const x = AIRPORT.includes(a) ? 'KLIA' : a;
  const y = AIRPORT.includes(b) ? 'KLIA' : b;
  const now: Record<string, number> = { 'BTS-KLS': 6.5, 'KLS-PJY': 14, 'KLS-STG': 18.3, 'KLIA-KLS': 55 };
  const next: Record<string, number> = {
    'BTS-KLS': 7.7, 'KLS-PJY': 16.6, 'KLS-STG': 21.6, 'KLIA-KLS': 65,
    'BTS-PJY': 9.5, 'BTS-STG': 14.7, 'PJY-STG': 5.6,
    'BTS-KLIA': 45.4, 'KLIA-PJY': 11.5, 'KLIA-STG': 5.8,
  };
  return (table === 'now' ? now : next)[key(x, y)] ?? null;
}

export function erlFare(fromId: string, toId: string, at: number): { min: number; max: number } {
  const a = fromId.replace(/^erl:/, '');
  const b = toId.replace(/^erl:/, '');
  if (AIRPORT.includes(a) && AIRPORT.includes(b)) return { min: 2, max: 2 }; // between the two terminals
  const r1 = (n: number) => Math.round(n * 10) / 10;
  if (at >= NEW_FARES_FROM) {
    const f = pairFare(a, b, 'new');
    if (f !== null) return { min: f, max: f };
  } else {
    const f = pairFare(a, b, 'now');
    if (f !== null) return { min: f, max: f };
    const later = pairFare(a, b, 'new');
    if (later !== null) return { min: r1(later / 1.22), max: r1(later / 1.14) };
  }
  return { min: 5, max: 65 };
}
