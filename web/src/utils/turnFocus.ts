import type { RouteStep } from '@/types';

/** Turns worth an arrow on the road and a closer look: not the start/end, not "carry on straight". */
export function isRealTurn(step: RouteStep | undefined): boolean {
  if (!step) return false;
  const { type, modifier } = step.maneuver;
  if (type === 'arrive' || type === 'depart') return false;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return true;
  return Boolean(modifier && modifier !== 'straight');
}

/** Close the camera in from this far before a town turn… */
export const ZOOM_IN_WITHIN_M = 150;
/** …only below ~60 km/h (on highways the normal view is better) */
const ZOOM_IN_MAX_MPS = 17;

/**
 * Driving camera zoom. Normally 16.5 (15.5 fast); just before a turn on an
 * ordinary road it closes in to 17.5 for those few seconds, so small junctions
 * and side roads are easy to tell apart, then zooms back out after the turn.
 */
export function cameraZoom(speedMps: number | null | undefined, next: RouteStep | undefined, distanceToManeuver: number | null | undefined): number {
  const speed = speedMps ?? 0;
  const base = speed > 22 ? 15.5 : 16.5;
  if (distanceToManeuver == null || !isRealTurn(next) || next?.motorway) return base;
  if (speed > ZOOM_IN_MAX_MPS || distanceToManeuver > ZOOM_IN_WITHIN_M) return base;
  return 17.5;
}
