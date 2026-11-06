/** Helpers for smooth vehicle motion between GPS fixes. */

/** Signed smallest difference b - a in degrees, in (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = (((b - a) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

/** Interpolate bearings along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  return (a + angleDelta(a, b) * t + 360) % 360;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Animation length matching the GPS update rate, so the car never stops between fixes. */
export function stepDuration(prevTs: number | null, ts: number): number {
  if (prevTs === null) return 0;
  return Math.max(250, Math.min(1500, ts - prevTs));
}
