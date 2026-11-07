import type { Coordinates, Route } from '@/types';
import { straightLineRoute } from '@/utils/routeProgress';
import { ApiError, apiGet, isServiceUnavailable } from './apiClient';

export interface RoutesResponse {
  routes: Route[];
  mode: 'live' | 'demo';
  notice?: string;
}

/**
 * Driving routes from the JalanGo API (Mapbox Directions, traffic-aware).
 * Without a live routing service it returns a single straight-line preview
 * that the UI labels as demo — never a made-up road route.
 */
export async function fetchRoutes(
  from: Coordinates,
  to: Coordinates,
  opts: { live: boolean; avoidTolls: boolean; destinationName: string; via?: Coordinates[]; heading?: number | null; signal?: AbortSignal },
): Promise<RoutesResponse> {
  const demo = (notice?: string): RoutesResponse => ({ routes: [straightLineRoute(from, to, opts.destinationName)], mode: 'demo', notice });

  if (!opts.live) return demo();
  try {
    const { routes } = await apiGet<{ routes: Route[] }>(
      '/directions',
      {
        from: `${from.lng},${from.lat}`,
        to: `${to.lng},${to.lat}`,
        avoidTolls: opts.avoidTolls ? 1 : undefined,
        heading: opts.heading != null ? Math.round(opts.heading) % 360 : undefined,
        via: opts.via?.length ? opts.via.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';') : undefined,
      },
      opts.signal,
    );
    if (routes.length === 0) throw new ApiError(422, 'no_route', 'No driving route found');
    return { routes, mode: 'live' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (err instanceof ApiError && err.code === 'no_route') throw err;
    if (isServiceUnavailable(err)) return demo('Live routing is unavailable right now — showing a straight-line preview.');
    throw err;
  }
}
