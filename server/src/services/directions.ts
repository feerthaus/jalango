import { config } from '../config.js';
import { priceTolls } from './tolls.js';
import { HttpError } from '../lib/errors.js';
import { guardUsage } from '../lib/usageGuard.js';
import type { Congestion, Coordinates, Route, RouteStep, TollPoint } from '../types.js';

const DIRECTIONS_TRAFFIC = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
// driving-traffic accepts at most 3 coordinates; routes through a shortcut need more
const DIRECTIONS_PLAIN = 'https://api.mapbox.com/directions/v5/mapbox/driving';
const DIRECTIONS_WALKING = 'https://api.mapbox.com/directions/v5/mapbox/walking';
export const MAX_VIA = 20;
const TIMEOUT_MS = 8000;

interface MbIntersection {
  location?: [number, number];
  classes?: string[];
  toll_collection?: { type?: string; name?: string };
  lanes?: { indications?: string[]; valid?: boolean }[];
  traffic_signal?: boolean;
}
interface MbMaxspeed {
  speed?: number;
  unit?: string;
  unknown?: boolean;
  none?: boolean;
}
interface MbStep {
  distance: number;
  duration: number;
  name?: string;
  ref?: string;
  destinations?: string;
  exits?: string;
  maneuver: { type: string; modifier?: string; instruction?: string; location: [number, number]; bearing_after?: number; exit?: number };
  intersections?: MbIntersection[];
}
interface MbLeg {
  summary?: string;
  steps?: MbStep[];
  annotation?: { congestion?: string[]; maxspeed?: MbMaxspeed[] };
}
interface MbRoute {
  distance: number;
  duration: number;
  duration_typical?: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  legs: MbLeg[];
}

/** A light this close to a turn counts as "at the lights" (same junction). */
const SIGNAL_AT_TURN_M = 35;

/** Rough metres between two nearby points. */
function metres(a: Coordinates, b: Coordinates): number {
  const x = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  const y = (b.lat - a.lat) * 110_574;
  return Math.hypot(x, y);
}

const CONGESTION: Congestion[] = ['low', 'moderate', 'heavy', 'severe', 'unknown'];

function lanesOf(i: MbIntersection | undefined): RouteStep['lanes'] {
  if (!i?.lanes?.length || i.lanes.length < 2) return undefined;
  return i.lanes.map((l) => ({ indications: l.indications ?? [], valid: Boolean(l.valid) }));
}

export function normalizeRoute(r: MbRoute, index: number): Route {
  const steps: RouteStep[] = [];
  let hasTolls = false;
  let hasMotorway = false;
  const congestion: Congestion[] = [];
  const summaries: string[] = [];
  const maxspeeds: (number | null)[] = [];
  const tollPoints: TollPoint[] = [];
  let tollMeters = 0;
  const signals: Coordinates[] = [];

  for (const leg of r.legs ?? []) {
    if (leg.summary) summaries.push(leg.summary);
    for (const m of leg.annotation?.maxspeed ?? []) {
      maxspeeds.push(m.speed && !m.unknown && !m.none ? (m.unit === 'mph' ? Math.round(m.speed * 1.609) : m.speed) : null);
    }
    for (const c of leg.annotation?.congestion ?? []) {
      congestion.push((CONGESTION as string[]).includes(c) ? (c as Congestion) : 'unknown');
    }
    for (const s of leg.steps ?? []) {
      let stepMotorway = false;
      // share of this step on toll roads (intersections sample the step along its length)
      const ix = s.intersections ?? [];
      if (ix.length) tollMeters += (s.distance * ix.filter((i) => i.classes?.includes('toll')).length) / ix.length;
      for (const i of s.intersections ?? []) {
        if (i.classes?.includes('toll')) hasTolls = true;
        const tc = i.toll_collection;
        if (tc && i.location) {
          tollPoints.push({ type: tc.type === 'toll_gantry' ? 'gantry' : 'booth', name: tc.name || undefined, location: { lng: i.location[0], lat: i.location[1] } });
          hasTolls = true;
        }
        // Traffic lights on the route (only where the map data has them)
        if (i.traffic_signal && i.location) {
          const at = { lng: i.location[0], lat: i.location[1] };
          const last = signals[signals.length - 1];
          // one junction is often several nodes a few metres apart: keep one light per junction
          if (!last || metres(last, at) > 25) signals.push(at);
        }
        if (i.classes?.includes('motorway')) {
          hasMotorway = true;
          stepMotorway = true;
        }
      }
      steps.push({
        instruction: s.maneuver.instruction ?? '',
        distanceMeters: s.distance,
        durationSeconds: s.duration,
        maneuver: {
          type: s.maneuver.type,
          modifier: s.maneuver.modifier,
          location: { lng: s.maneuver.location[0], lat: s.maneuver.location[1] },
          bearingAfter: s.maneuver.bearing_after,
          exit: s.maneuver.exit,
        },
        roadName: s.name || undefined,
        roadRef: s.ref || undefined,
        motorway: stepMotorway || undefined,
        destinations: s.destinations || undefined,
        lanes: lanesOf(s.intersections?.[0]),
        atSignal: s.intersections?.[0]?.traffic_signal ? true : undefined,
        exits: s.exits || undefined,
      });
    }
  }

  // A junction's light is often on a node a few metres from the turn point (the
  // stop line, or the other carriageway): still the same junction
  for (const st of steps) {
    if (!st.atSignal && signals.some((g) => metres(g, st.maneuver.location) <= SIGNAL_AT_TURN_M)) st.atSignal = true;
  }

  return {
    id: `mapbox-${index}`,
    geometry: r.geometry,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    typicalDurationSeconds: r.duration_typical,
    summary: summaries.join(' · '),
    steps,
    hasTolls,
    tollPoints: tollPoints.length ? tollPoints : undefined,
    // Mapbox doesn't tag toll roads in Malaysia (only the toll plazas): 0 means unknown, not free
    tollMeters: hasTolls && tollMeters > 0 ? Math.round(tollMeters) : undefined,
    tollFare: priceTolls(tollPoints).total ?? undefined,
    hasMotorway,
    signals: signals.length ? signals : undefined,
    congestion: congestion.length === r.geometry.coordinates.length - 1 ? congestion : undefined,
    maxspeeds: maxspeeds.length === r.geometry.coordinates.length - 1 && maxspeeds.some((v) => v !== null) ? maxspeeds : undefined,
    source: 'mapbox',
  };
}

type DirectionsOpts = { avoidTolls?: boolean; via?: Coordinates[]; heading?: number; walking?: boolean; avoidPoints?: Coordinates[] };

/** Most points a route may be asked to avoid (e.g. impassable floods). */
export const MAX_AVOID = 10;

export function buildDirectionsUrl(from: Coordinates, to: Coordinates, opts: DirectionsOpts = {}): URL {
  const via = (opts.via ?? []).slice(0, MAX_VIA);
  const points = [from, ...via, to];
  if (opts.walking) {
    // On foot: footpaths, crossings and pedestrian bridges; no traffic, tolls or heading
    const url = new URL(`${DIRECTIONS_WALKING}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}`);
    url.searchParams.set('alternatives', via.length === 0 ? 'true' : 'false');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'true');
    url.searchParams.set('language', 'en');
    if (via.length > 0) url.searchParams.set('waypoints', `0;${points.length - 1}`);
    return url;
  }
  const useTraffic = via.length <= 1;
  const url = new URL(`${useTraffic ? DIRECTIONS_TRAFFIC : DIRECTIONS_PLAIN}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}`);
  // Alternatives only make sense (and are only allowed) between two points
  url.searchParams.set('alternatives', via.length === 0 ? 'true' : 'false');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('annotations', useTraffic ? 'congestion,maxspeed' : 'maxspeed');
  url.searchParams.set('language', 'en');
  // Via points are silent: no "you have arrived" at each one
  if (via.length > 0) url.searchParams.set('waypoints', `0;${points.length - 1}`);
  // Tolls and spots to keep away from (impassable floods): exclude=toll,point(lng lat),…
  const exclude = [
    ...(opts.avoidTolls ? ['toll'] : []),
    ...(opts.avoidPoints ?? []).slice(0, MAX_AVOID).map((p) => `point(${p.lng.toFixed(5)} ${p.lat.toFixed(5)})`),
  ];
  if (exclude.length) url.searchParams.set('exclude', exclude.join(','));
  // Start on the road segment that points the way we're driving (±45°), like Waze/Google do
  if (opts.heading !== undefined && Number.isFinite(opts.heading)) {
    url.searchParams.set('bearings', `${Math.round(opts.heading) % 360},45${';'.repeat(points.length - 1)}`);
  }
  return url;
}

/**
 * Routes that keep away from `avoidPoints` when the router can; if it can't
 * (no route, or the router refuses the points), routes without them.
 * `avoided` says how many points the returned routes actually avoid.
 */
export async function getDirectionsAvoiding(from: Coordinates, to: Coordinates, opts: DirectionsOpts): Promise<{ routes: Route[]; avoided: number }> {
  const points = (opts.avoidPoints ?? []).slice(0, MAX_AVOID);
  if (!points.length || opts.walking) return { routes: await getDirections(from, to, { ...opts, avoidPoints: undefined }), avoided: 0 };
  try {
    return { routes: await getDirections(from, to, { ...opts, avoidPoints: points }), avoided: points.length };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 422 || err.code === 'upstream_error')) {
      return { routes: await getDirections(from, to, { ...opts, avoidPoints: undefined }), avoided: 0 };
    }
    throw err;
  }
}

export async function getDirections(
  from: Coordinates,
  to: Coordinates,
  opts: DirectionsOpts = {},
): Promise<Route[]> {
  if (!config.mapboxToken) {
    throw new HttpError(503, 'mapbox_not_configured', 'Mapbox is not configured on the server');
  }
  if (opts.heading !== undefined && !opts.walking) {
    try {
      return await fetchDirections(from, to, opts);
    } catch (err) {
      // No road matches our heading near the start (e.g. car park): try again without it
      if (err instanceof HttpError && err.status === 422) return fetchDirections(from, to, { ...opts, heading: undefined });
      throw err;
    }
  }
  return fetchDirections(from, to, opts);
}

async function fetchDirections(
  from: Coordinates,
  to: Coordinates,
  opts: DirectionsOpts,
): Promise<Route[]> {
  const url = buildDirectionsUrl(from, to, opts);
  await guardUsage('directions'); // each attempt, including the retry without a heading
  url.searchParams.set('access_token', config.mapboxToken ?? '');

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'TimeoutError';
    throw new HttpError(502, timedOut ? 'upstream_timeout' : 'upstream_unreachable', 'Routing service unavailable');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'upstream_auth', 'Routing service rejected the server credentials');
  if (res.status === 429) throw new HttpError(429, 'upstream_rate_limited', 'Routing service rate limit reached');

  const body = (await res.json().catch(() => null)) as { code?: string; message?: string; routes?: MbRoute[] } | null;
  if (body?.code === 'NoRoute' || body?.code === 'NoSegment') {
    throw new HttpError(422, 'no_route', opts.walking ? 'No walking route found between these points' : 'No driving route found between these points');
  }
  if (!res.ok || !body || body.code !== 'Ok') {
    throw new HttpError(502, 'upstream_error', body?.message ?? `Routing service error (${res.status})`);
  }
  return (body.routes ?? []).map(normalizeRoute);
}
