import { bearingDeg } from './routeProgress';
import { angleDelta } from './motion';
import { haversineMeters } from './geo';

/**
 * EXPERIMENTAL oncoming-vehicle detection between JalanGo drivers.
 *
 * Only ever produces a "don't overtake" warning — never a "safe to
 * overtake" signal. Vehicles without JalanGo are invisible to it.
 */
export interface DriverState {
  lat: number;
  lng: number;
  /** degrees from north */
  heading: number;
  /** m/s */
  speed: number;
  /** epoch ms of the position */
  t: number;
}

export interface OncomingThreat {
  id: string;
  distance: number;
  secondsToMeet: number;
}

export const ONCOMING = {
  minOwnSpeed: 8, // ~30 km/h: no alerts in slow traffic
  minOtherSpeed: 5,
  maxAgeMs: 4000, // ignore stale positions
  aheadConeDeg: 20, // the other car is roughly in front of us
  minHeadingDiff: 150, // and driving towards us
  maxLateralM: 20, // on the same (undivided) road
  minDistanceM: 40,
  maxDistanceM: 900,
  maxSecondsToMeet: 15,
} as const;

/** Move a position forward along its heading (flat-earth, fine for < 1 km). */
export function extrapolate(s: DriverState, now: number): DriverState {
  const dt = Math.max(0, Math.min(ONCOMING.maxAgeMs, now - s.t)) / 1000;
  const d = s.speed * dt;
  const rad = (s.heading * Math.PI) / 180;
  return {
    ...s,
    lat: s.lat + (d * Math.cos(rad)) / 110_574,
    lng: s.lng + (d * Math.sin(rad)) / (111_320 * Math.cos((s.lat * Math.PI) / 180)),
    t: now,
  };
}

export function detectOncoming(me: DriverState, others: Map<string, DriverState>, now: number): OncomingThreat | null {
  if (me.speed < ONCOMING.minOwnSpeed) return null;
  let best: OncomingThreat | null = null;
  for (const [id, raw] of others) {
    if (now - raw.t > ONCOMING.maxAgeMs || raw.speed < ONCOMING.minOtherSpeed) continue;
    const o = extrapolate(raw, now);
    const distance = haversineMeters({ lat: me.lat, lng: me.lng }, { lat: o.lat, lng: o.lng });
    if (distance < ONCOMING.minDistanceM || distance > ONCOMING.maxDistanceM) continue;
    const toOther = bearingDeg([me.lng, me.lat], [o.lng, o.lat]);
    const off = Math.abs(angleDelta(me.heading, toOther));
    if (off > ONCOMING.aheadConeDeg) continue;
    if (Math.abs(angleDelta(me.heading, o.heading)) < ONCOMING.minHeadingDiff) continue;
    const lateral = distance * Math.sin((off * Math.PI) / 180);
    if (lateral > ONCOMING.maxLateralM) continue;
    const secondsToMeet = distance / (me.speed + o.speed);
    if (secondsToMeet > ONCOMING.maxSecondsToMeet) continue;
    if (!best || secondsToMeet < best.secondsToMeet) best = { id, distance, secondsToMeet };
  }
  return best;
}

/** ~5.5 km grid cell used to pick realtime channels. */
export function cellOf(lat: number, lng: number): [number, number] {
  return [Math.floor(lng / 0.05), Math.floor(lat / 0.05)];
}

export function neighbourCells([x, y]: [number, number]): string[] {
  const out: string[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(`${x + dx}:${y + dy}`);
  return out;
}
