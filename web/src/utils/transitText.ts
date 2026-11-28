import type { TFn } from '@/lib/i18n';

/** "RM18.30" for a fixed fare; whole ringgit without decimals. */
export const rm = (n: number) => `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** "RM18.30" for a fixed fare, "RM56–RM58.90" for a range. */
export const fare = (min: number, max: number) => (min === max ? rm(min) : `${rm(min)}–${rm(max)}`);

/** "5 min", "6 j 57 min" / "6 h 57 min": how long until something. */
export function waitText(minutes: number, t: TFn): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return t(`${m} min`, `${m} min`);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? t(`${h} j ${r} min`, `${h} h ${r} min`) : t(`${h} j`, `${h} h`);
}

/** "350 m" under 1 km, "1.2 km" above: never "0 km". */
export function distText(km: number): string {
  return km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1).replace(/\.0$/, '')} km`;
}

/** Under this, a station is at the destination itself: no walk to speak of. */
export const AT_STATION_KM = 0.1;

/**
 * A first departure this far away (in minutes) means nothing runs now: the
 * person is shown "nothing more tonight, first one at …" instead of a list that
 * looks like it is leaving soon.
 */
export const LATE_MINUTES = 180;
