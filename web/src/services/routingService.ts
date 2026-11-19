import type { Coordinates, Route } from '@/types';
import { straightLineRoute } from '@/utils/routeProgress';
import { ApiError, apiGet, isServiceUnavailable } from './apiClient';

export interface RoutesResponse {
  routes: Route[];
  mode: 'live' | 'demo';
  notice?: string;
  /** impassable floods the routes go around (0 when none, or the router couldn't avoid them) */
  avoidedFloods?: number;
}

/**
 * Driving routes from the JalanGo API (Mapbox Directions, traffic-aware).
 * Without a live routing service it returns a single straight-line preview
 * that the UI labels as demo — never a made-up road route.
 */
export async function fetchRoutes(
  from: Coordinates,
  to: Coordinates,
  opts: { live: boolean; avoidTolls: boolean; destinationName: string; via?: Coordinates[]; heading?: number | null; walking?: boolean; avoid?: Coordinates[]; signal?: AbortSignal },
): Promise<RoutesResponse> {
  const demo = (notice?: string): RoutesResponse => ({ routes: [straightLineRoute(from, to, opts.destinationName, opts.walking ? 4.5 : 50)], mode: 'demo', notice });

  if (!opts.live) return demo();
  try {
    const { routes, avoided } = await apiGet<{ routes: Route[]; avoided?: number }>(
      '/directions',
      {
        from: `${from.lng},${from.lat}`,
        to: `${to.lng},${to.lat}`,
        profile: opts.walking ? 'walking' : undefined,
        avoidTolls: opts.avoidTolls && !opts.walking ? 1 : undefined,
        heading: opts.heading != null && !opts.walking ? Math.round(opts.heading) % 360 : undefined,
        via: opts.via?.length ? opts.via.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';') : undefined,
        avoid: opts.avoid?.length && !opts.walking ? opts.avoid.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';') : undefined,
      },
      opts.signal,
    );
    if (routes.length === 0) throw new ApiError(422, 'no_route', opts.walking ? 'No walking route found' : 'No driving route found');
    return { routes, mode: 'live', avoidedFloods: avoided ?? 0 };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (err instanceof ApiError && err.code === 'no_route') throw err;
    if (isServiceUnavailable(err)) return demo('Live routing is unavailable right now — showing a straight-line preview.');
    throw err;
  }
}
