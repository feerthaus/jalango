import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import type { Calendar, FeedRoute } from './gtfs.js';
import { assembleNetwork, type Network, type Pattern, type Stop } from './raptor.js';

/**
 * The whole public transport network (trains, LRT/MRT and buses) as one small
 * gzipped JSON, built once a day by a scheduled function and loaded by the API
 * in a fraction of a second instead of parsing ~50 MB of timetables.
 *
 * Trip times are stored relative to the trip's first departure:
 *   [serviceIdx, firstDep, arr1-firstDep, dep1-arr1, arr2-firstDep, …]
 */
export const SNAPSHOT_VERSION = 1;

interface Snapshot {
  v: number;
  builtAt: string;
  feeds: string[];
  stops: [string, string, number, number][];
  routes: [string, string, string, string, FeedRoute['mode']][];
  services: string[];
  calendars: [string, string, string, string][]; // key, start, end, days "1111100"
  exceptions: [string, 1 | 2][];
  patterns: { r: number; s: number[]; t: number[][] }[];
}

export function serializeNetwork(net: Network, feeds: string[]): Uint8Array {
  const routes = new Map<FeedRoute, number>();
  const routeList: Snapshot['routes'] = [];
  const services = new Map<string, number>();
  const serviceList: string[] = [];
  const patterns = net.patterns.map((p) => {
    if (!routes.has(p.route)) {
      routes.set(p.route, routeList.length);
      routeList.push([p.route.id, p.route.shortName, p.route.longName, p.route.color, p.route.mode]);
    }
    return {
      r: routes.get(p.route)!,
      s: p.stops,
      t: p.trips.map((t) => {
        if (!services.has(t.serviceKey)) {
          services.set(t.serviceKey, serviceList.length);
          serviceList.push(t.serviceKey);
        }
        const base = t.dep[0];
        const row = [services.get(t.serviceKey)!, base];
        for (let i = 0; i < t.arr.length; i++) row.push(t.arr[i] - base, t.dep[i] - t.arr[i]);
        return row;
      }),
    };
  });
  const snap: Snapshot = {
    v: SNAPSHOT_VERSION,
    builtAt: new Date().toISOString(),
    feeds,
    stops: net.stops.map((s) => [s.id, s.name, Math.round(s.lat * 1e6) / 1e6, Math.round(s.lng * 1e6) / 1e6]),
    routes: routeList,
    services: serviceList,
    calendars: [...net.calendars].map(([k, c]) => [k, c.start, c.end, c.days.map((d) => (d ? '1' : '0')).join('')]),
    exceptions: [...net.exceptions],
    patterns,
  };
  return gzipSync(strToU8(JSON.stringify(snap)), { level: 6 });
}

export function deserializeNetwork(bytes: Uint8Array): { net: Network; builtAt: string; feeds: string[] } {
  const snap = JSON.parse(strFromU8(gunzipSync(bytes))) as Snapshot;
  if (snap.v !== SNAPSHOT_VERSION) throw new Error(`snapshot version ${snap.v}`);
  const stops: Stop[] = snap.stops.map(([id, name, lat, lng]) => ({ id, name, lat, lng }));
  const routes: FeedRoute[] = snap.routes.map(([id, shortName, longName, color, mode]) => ({ id, shortName, longName, color, mode }));
  const patterns: Pattern[] = snap.patterns.map((p, pi) => ({
    route: routes[p.r],
    stops: p.s,
    trips: p.t.map((row, ti) => {
      const base = row[1];
      const arr: number[] = [];
      const dep: number[] = [];
      for (let i = 2; i < row.length; i += 2) {
        const a = base + row[i];
        arr.push(a);
        dep.push(a + row[i + 1]);
      }
      return { id: `${pi}.${ti}`, serviceKey: snap.services[row[0]], arr, dep };
    }),
  }));
  const calendars = new Map<string, Calendar>(snap.calendars.map(([k, start, end, days]) => [k, { start, end, days: [...days].map((d) => d === '1') }]));
  const exceptions = new Map(snap.exceptions);
  return { net: assembleNetwork(stops, patterns, calendars, exceptions), builtAt: snap.builtAt, feeds: snap.feeds };
}
