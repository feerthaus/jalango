/**
 * Live-share traffic status, worked out on the driver's phone:
 *  - "slow": below 15 km/h for 2 minutes while navigating (not close to the
 *    destination), cleared after 30 s above 25 km/h (no flicker at lights);
 *  - honest ETA: never earlier than the route's own remaining time, refreshed
 *    with live traffic; "late by" = ETA now minus the ETA when the trip began.
 */
export const SLOW_KMH = 15;
export const RESUME_KMH = 25;
export const SLOW_AFTER_MS = 2 * 60_000;
export const RESUME_AFTER_MS = 30_000;
/** Within this distance of the destination, slowing down is just arriving. */
export const NEAR_DEST_M = 600;

export interface SlowState {
  /** when the current slow stretch began (ms) */
  slowSince: number | null;
  /** when speed went back above RESUME_KMH (ms) */
  fastSince: number | null;
}

export const NOT_SLOW: SlowState = { slowSince: null, fastSince: null };

export function nextSlowState(prev: SlowState, kmh: number, now: number): SlowState {
  if (kmh < SLOW_KMH) return { slowSince: prev.slowSince ?? now, fastSince: null };
  if (kmh >= RESUME_KMH) {
    const fastSince = prev.fastSince ?? now;
    return now - fastSince >= RESUME_AFTER_MS ? NOT_SLOW : { slowSince: prev.slowSince, fastSince };
  }
  return { slowSince: prev.slowSince, fastSince: null }; // in between: keep as is
}

/** What the share shows as "in traffic since", or null. */
export function publishedSlowSince(s: SlowState, now: number, remainingMeters: number | null): number | null {
  if (s.slowSince === null || now - s.slowSince < SLOW_AFTER_MS) return null;
  if (remainingMeters !== null && remainingMeters < NEAR_DEST_M) return null;
  return s.slowSince;
}

export interface LiveEta {
  /** fetched at (ms) */
  at: number;
  /** traffic-aware duration from where we were then (s) */
  seconds: number;
  /** distance left then (m) */
  meters: number;
}

/** ETA (ms): the route's remaining time, or the latest live-traffic estimate scaled to what's left, whichever is later. */
export function honestEta(now: number, routeRemainingSeconds: number, remainingMeters: number, live: LiveEta | null): number {
  const fromRoute = now + routeRemainingSeconds * 1000;
  if (!live || live.meters <= 0) return fromRoute;
  const fromLive = now + live.seconds * Math.min(1, remainingMeters / live.meters) * 1000;
  return Math.max(fromRoute, fromLive);
}

/** Seconds later than the ETA when the trip began (0 if on time or early). */
export function delaySeconds(eta: number, baselineEta: number | null): number {
  if (baselineEta === null) return 0;
  return Math.max(0, Math.min(6 * 3600, Math.round((eta - baselineEta) / 1000)));
}
