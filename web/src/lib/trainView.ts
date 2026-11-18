import { useSyncExternalStore } from 'react';
import type { TransitOption } from '@/services/transitService';
import type { Coordinates } from '@/types';

/**
 * The train option shown on the map while the route panel's "Awam" tab is
 * open (TransitOptions sets it, TrainLayer draws it, RouteLayer hides the car
 * routes meanwhile).
 */
export interface TrainView {
  option: TransitOption;
  from: Coordinates;
  to: Coordinates;
}

let current: TrainView | null = null;
const listeners = new Set<() => void>();

export function setTrainView(next: TrainView | null): void {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export function useTrainView(): TrainView | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
