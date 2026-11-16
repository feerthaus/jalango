import { haversineMeters } from './geo';
import type { Coordinates } from '@/types';

/** Car this close to the target counts as arrived. */
export const ARRIVE_M = 150;
/**
 * A share that ends ("until I arrive" stops when navigation finishes) counts as
 * arrived if its last position was this close: positions are sent every ~5 s,
 * so the last one can be a little short of the door.
 */
export const ENDED_NEAR_M = 300;

export interface ArrivalInput {
  status: 'live' | 'stopped' | 'expired';
  position: Coordinates | null;
  /** where "arrived" is measured to: the waiter's own spot, else the driver's destination */
  target: Coordinates | null;
  /** status at the previous poll (to tell "just stopped" from "was never live here") */
  previousStatus: 'live' | 'stopped' | 'expired' | null;
}

/** Has the driver arrived? Pure: the page calls it on every poll. */
export function hasArrived({ status, position, target, previousStatus }: ArrivalInput): boolean {
  if (!position || !target) return false;
  const d = haversineMeters(position, target);
  if (status === 'live') return d <= ARRIVE_M;
  // Sharing just ended while we were watching: the trip finished near the target
  return status === 'stopped' && previousStatus === 'live' && d <= ENDED_NEAR_M;
}
