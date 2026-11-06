import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import type { Congestion, Coordinates, Route, RouteStep } from '../types.js';

const DIRECTIONS_TRAFFIC = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
// driving-traffic accepts at most 3 coordinates; routes through a shortcut need more
const DIRECTIONS_PLAIN = 'https://api.mapbox.com/directions/v5/mapbox/driving';
export const MAX_VIA = 20;
const TIMEOUT_MS = 8000;

interface MbIntersection {
  classes?: string[];
}
interface MbStep {
  distance: number;
  duration: number;
  name?: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; instruction?: string; location: [number, number]; bearing_after?: number; exit?: number };
  intersections?: MbIntersection[];
}
interface MbLeg {
  summary?: string;
  steps?: MbStep[];
  annotation?: { congestion?: string[] };
}
interface MbRoute {
  distance: number;
  duration: number;
  duration_typical?: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  legs: MbLeg[];
}

const CONGESTION: Congestion[] = ['low', 'moderate', 'heavy', 'severe', 'unknown'];

export function normalizeRoute(r: MbRoute, index: number): Route {
  const steps: RouteStep[] = [];
  let hasTolls = false;
  let hasMotorway = false;
  const congestion: Congestion[] = [];
  const summaries: string[] = [];

  for (const leg of r.legs ?? []) {
    if (leg.summary) summaries.push(leg.summary);
    for (const c of leg.annotation?.congestion ?? []) {
      congestion.push((CONGESTION as string[]).includes(c) ? (c as Congestion) : 'unknown');
    }
    for (const s of leg.steps ?? []) {
      for (const i of s.intersections ?? []) {
        if (i.classes?.includes('toll')) hasTolls = true;
        if (i.classes?.includes('motorway')) hasMotorway = true;
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
      });
    }
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
    hasMotorway,
    congestion: congestion.length === r.geometry.coordinates.length - 1 ? congestion : undefined,
    source: 'mapbox',
  };
}

export function buildDirectionsUrl(from: Coordinates, to: Coordinates, opts: { avoidTolls?: boolean; via?: Coordinates[] } = {}): URL {
  const via = (opts.via ?? []).slice(0, MAX_VIA);
  const points = [from, ...via, to];
  const useTraffic = via.length <= 1;
  const url = new URL(`${useTraffic ? DIRECTIONS_TRAFFIC : DIRECTIONS_PLAIN}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}`);
  // Alternatives only make sense (and are only allowed) between two points
  url.searchParams.set('alternatives', via.length === 0 ? 'true' : 'false');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');
  if (useTraffic) url.searchParams.set('annotations', 'congestion');
  url.searchParams.set('language', 'en');
  // Via points are silent: no "you have arrived" at each one
  if (via.length > 0) url.searchParams.set('waypoints', `0;${points.length - 1}`);
  if (opts.avoidTolls) url.searchParams.set('exclude', 'toll');
  return url;
}

export async function getDirections(
  from: Coordinates,
  to: Coordinates,
  opts: { avoidTolls?: boolean; via?: Coordinates[] } = {},
): Promise<Route[]> {
  if (!config.mapboxToken) {
    throw new HttpError(503, 'mapbox_not_configured', 'Mapbox is not configured on the server');
  }
  const url = buildDirectionsUrl(from, to, opts);
  url.searchParams.set('access_token', config.mapboxToken);

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
    throw new HttpError(422, 'no_route', 'No driving route found between these points');
  }
  if (!res.ok || !body || body.code !== 'Ok') {
    throw new HttpError(502, 'upstream_error', body?.message ?? `Routing service error (${res.status})`);
  }
  return (body.routes ?? []).map(normalizeRoute);
}
