import { useCallback, useSyncExternalStore } from 'react';
import { shade } from '@/utils/convoy';

export type Vehicle = 'car' | 'motorcycle';
const KEY = 'jalango:my-vehicle';
const EVENT = 'jalango:vehicle-change';

function read(): Vehicle {
  try {
    return localStorage.getItem(KEY) === 'motorcycle' ? 'motorcycle' : 'car';
  } catch {
    return 'car';
  }
}

/** What the driver is on (Profile / Konvoi); changes their own map icon and their convoy icon. */
export function useMyVehicle(): [Vehicle, (v: Vehicle) => void] {
  const v = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => 'car' as Vehicle,
  );
  const set = useCallback((next: Vehicle) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [v, set];
}

/** Top-down motorcycle with rider (pointing up), same style as the car. */
export function motoSvg(color = '#14c493', width = 24): string {
  const height = Math.round(width * 2);
  const dark = shade(color, -0.3);
  return `
<svg viewBox="0 0 24 48" width="${width}" height="${height}" aria-hidden="true" style="display:block;filter:drop-shadow(0 3px 4px rgb(0 0 0 / .45))">
  <rect x="9" y="1" width="6" height="11" rx="3" fill="#0b1220"/>
  <rect x="9" y="36" width="6" height="11" rx="3" fill="#0b1220"/>
  <rect x="2" y="11" width="20" height="3" rx="1.5" fill="#0b1220"/>
  <path d="M12 8c3.5 0 5.5 2.5 5.5 6v16c0 4-2.5 7-5.5 7s-5.5-3-5.5-7V14c0-3.5 2-6 5.5-6Z" fill="${color}" stroke="#fff" stroke-width="2"/>
  <rect x="10.5" y="3" width="3" height="2" rx="1" fill="#fff8d6"/>
  <ellipse cx="12" cy="24" rx="5.2" ry="6.5" fill="${dark}"/>
  <circle cx="12" cy="21" r="4.2" fill="#1e2a44" stroke="#fff" stroke-width="1.2"/>
  <rect x="10.5" y="44" width="3" height="2" rx="1" fill="#ff3b30"/>
</svg>`;
}
