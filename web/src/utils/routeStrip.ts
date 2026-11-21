import type { Congestion, Route } from '@/types';
import { projectOnRoute, type RouteIndex } from './routeProgress';
import type { ReportOnRoute } from './routeAlerts';

/** A slow stretch of what's left of the route, as fractions (0 = you, 1 = destination). */
export interface StripRun {
  from: number;
  to: number;
  congestion: Exclude<Congestion, 'low' | 'unknown'>;
}

export type StripMarker = { pos: number; kind: 'report'; report: ReportOnRoute['report'] } | { pos: number; kind: 'toll'; name?: string };

export interface RouteStrip {
  runs: StripRun[];
  markers: StripMarker[];
}

/**
 * The rest of the trip on one line, like Waze's bottom sheet: slow traffic
 * coloured in, community reports and toll plazas placed where they are, from
 * where the driver is now (`along`) to the destination.
 */
export function routeStrip(route: Route, index: RouteIndex, along: number, onRoute: ReportOnRoute[]): RouteStrip {
  const left = index.total - along;
  if (left <= 0) return { runs: [], markers: [] };
  const pos = (d: number) => Math.min(1, Math.max(0, (d - along) / left));

  const runs: StripRun[] = [];
  const cong = route.congestion ?? [];
  for (let i = 0; i < cong.length && i + 1 < index.cum.length; i++) {
    const c = cong[i];
    if (c === 'low' || c === 'unknown') continue;
    const a = index.cum[i];
    const b = index.cum[i + 1];
    if (b <= along) continue;
    const from = pos(a);
    const to = pos(b);
    const last = runs[runs.length - 1];
    // join touching stretches of the same colour (and specks closer than 0.5 %)
    if (last && last.congestion === c && from - last.to < 0.005) last.to = to;
    else runs.push({ from, to, congestion: c });
  }

  const markers: StripMarker[] = [];
  for (const r of onRoute) if (r.along > along + 5) markers.push({ pos: pos(r.along), kind: 'report', report: r.report });
  let hint = 0;
  for (const t of route.tollPoints ?? []) {
    const p = projectOnRoute(index, t.location, hint);
    hint = p.segment;
    if (p.offset < 80 && p.along > along + 5) markers.push({ pos: pos(p.along), kind: 'toll', name: t.name });
  }
  markers.sort((a, b) => a.pos - b.pos);
  return { runs: runs.filter((r) => r.to - r.from > 0.002), markers };
}

/** Markers closer than this (share of the strip) are drawn as one, with a "+n" badge */
const CLUSTER = 0.07;

export function clusterMarkers<M extends { pos: number }>(markers: M[]): { marker: M; more: number }[] {
  const out: { marker: M; more: number }[] = [];
  for (const m of markers) {
    const last = out[out.length - 1];
    if (last && m.pos - last.marker.pos < CLUSTER) last.more += 1;
    else out.push({ marker: m, more: 0 });
  }
  return out;
}
