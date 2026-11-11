import type { AccidentRecord, Coordinates } from '@/types';
import { haversineMeters } from './geo';
import { projectOnRoute, type RouteIndex } from './routeProgress';

/** Records this close together count as the same spot (a junction, a bend). */
export const HOTSPOT_RADIUS_M = 150;
/** A spot is a "black spot" worth warning about from this many records. */
export const HOTSPOT_ALERT_MIN = 2;

export interface Hotspot {
  id: string;
  coordinates: Coordinates;
  /** newest first */
  records: AccidentRecord[];
  count: number;
  fatal: number;
  lastDate: string;
  firstDate: string;
}

/**
 * Group records into spots: greedy, densest first, each record joins the first
 * spot whose centre is within HOTSPOT_RADIUS_M. Stable for the same input.
 */
export function clusterAccidents(records: AccidentRecord[], radius = HOTSPOT_RADIUS_M): Hotspot[] {
  const pts = records.map((r) => ({ r, c: { lat: r.latitude, lng: r.longitude } }));
  // Density score: neighbours within the radius, so spots form around the busiest point
  const score = pts.map((p) => pts.filter((q) => haversineMeters(p.c, q.c) <= radius).length);
  const order = pts.map((_, i) => i).sort((a, b) => score[b] - score[a] || pts[a].r.id.localeCompare(pts[b].r.id));
  const used = new Set<number>();
  const spots: Hotspot[] = [];
  for (const i of order) {
    if (used.has(i)) continue;
    const members = order.filter((j) => !used.has(j) && haversineMeters(pts[i].c, pts[j].c) <= radius);
    members.forEach((j) => used.add(j));
    const recs = members.map((j) => pts[j].r).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at));
    const lat = recs.reduce((s, r) => s + r.latitude, 0) / recs.length;
    const lng = recs.reduce((s, r) => s + r.longitude, 0) / recs.length;
    spots.push({
      id: `spot:${recs[recs.length - 1].id}`,
      coordinates: { lat, lng },
      records: recs,
      count: recs.length,
      fatal: recs.filter((r) => r.outcome === 'fatal').length,
      lastDate: recs[0].occurred_on,
      firstDate: recs[recs.length - 1].occurred_on,
    });
  }
  return spots.sort((a, b) => b.count - a.count);
}

export interface HotspotOnRoute {
  spot: Hotspot;
  along: number;
}

/** Black spots lying on the route (within `maxOffset` m of it), in driving order. */
export function hotspotsOnRoute(index: RouteIndex, spots: Hotspot[], maxOffset = 80, min = HOTSPOT_ALERT_MIN): HotspotOnRoute[] {
  return spots
    .filter((s) => s.count >= min)
    .map((s) => ({ spot: s, p: projectOnRoute(index, s.coordinates) }))
    .filter((x) => x.p.offset <= maxOffset)
    .map((x) => ({ spot: x.spot, along: x.p.along }))
    .sort((a, b) => a.along - b.along);
}

/** What to say: "Awas, kawasan kerap kemalangan di hadapan. 6 kemalangan direkodkan." */
export function hotspotPhrase(spot: Hotspot, lang: 'ms' | 'en'): string {
  const fatal = spot.fatal > 0 ? (lang === 'ms' ? `, ${spot.fatal} maut` : `, ${spot.fatal} fatal`) : '';
  return lang === 'ms'
    ? `Awas, kawasan kerap kemalangan di hadapan. ${spot.count} kemalangan direkodkan${fatal}. Pandu berhati-hati.`
    : `Caution, accident black spot ahead. ${spot.count} crashes recorded${fatal}. Drive carefully.`;
}
